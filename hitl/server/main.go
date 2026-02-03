package server

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/schema"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

// Server represents the web server
type Server struct {
	engine      *gin.Engine
	hub         *WSHub
	execManager *ExecutionManager
	baseDir     string
	distDir     string
	port        int
}

// Config holds server configuration
type Config struct {
	Port        int
	BaseDir     string
	DistDir     string
	EnableCORS  bool
}

// DefaultConfig returns default server configuration
func DefaultConfig() Config {
	return Config{
		Port:       8080,
		BaseDir:    "./checkpoints_data",
		DistDir:    "./ui/dist",
		EnableCORS: true,
	}
}

// NewServer creates a new web server
func NewServer(cfg Config) (*Server, error) {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found: %v", err)
	}

	// Create base directory
	if err := os.MkdirAll(cfg.BaseDir, 0755); err != nil {
		return nil, fmt.Errorf("create base directory: %w", err)
	}

	// Create Gin engine
	if cfg.EnableCORS {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	engine := gin.New()
	engine.Use(gin.Recovery())
	engine.Use(gin.Logger())

	// Setup CORS
	if cfg.EnableCORS {
		engine.Use(cors.New(cors.Config{
			AllowOrigins:     []string{"*"},
			AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
			ExposeHeaders:    []string{"Content-Length"},
			AllowCredentials: true,
			MaxAge:           12 * time.Hour,
		}))
	}

	// Create hub and execution manager
	hub := NewWSHub()
	hub.Run()

	execManager := NewExecutionManager()

	server := &Server{
		engine:      engine,
		hub:         hub,
		execManager: execManager,
		baseDir:     cfg.BaseDir,
		distDir:     cfg.DistDir,
		port:        cfg.Port,
	}

	// Setup routes
	server.setupRoutes()

	return server, nil
}

// setupRoutes configures all server routes
func (s *Server) setupRoutes() {
	api := s.engine.Group("/api")
	{
		// Execution routes
		api.POST("/execute", s.HandleExecute)
		api.POST("/execute/:id/resume", s.HandleResume)
		api.GET("/executions", s.HandleListExecutions)
		api.GET("/executions/:id", s.HandleGetExecution)
		api.GET("/state/:id", s.HandleGetState)
		api.GET("/logs/:id", s.HandleLogs)

		// Tool call confirmation
		api.POST("/confirm", s.HandleConfirm)

		// Checkpoint routes
		api.GET("/checkpoints", s.HandleListCheckpoints)
		api.DELETE("/checkpoints/:id", s.HandleDeleteCheckpoint)
	}

	// WebSocket route
	s.engine.GET("/ws/events/:id", s.HandleWebSocket)

	// Health check
	s.engine.GET("/api/health", s.HandleHealth)

	// Serve static files (frontend)
	s.engine.GET("/static/*filepath", s.HandleServeStatic)

	// Serve index
	s.engine.GET("/", s.HandleIndex)

	// Catch-all for SPA routing
	s.engine.NoRoute(s.HandleServeStatic)
}

// Run starts the server
func (s *Server) Run() error {
	addr := fmt.Sprintf(":%d", s.port)
	log.Printf("[Server] Starting HITL web server on %s", addr)
	log.Printf("[Server] Base directory: %s", s.baseDir)
	log.Printf("[Server] Static files: %s", s.distDir)

	if err := s.engine.Run(addr); err != nil {
		return fmt.Errorf("server error: %w", err)
	}

	return nil
}

// composeGraph creates the execution graph
func (s *Server) composeGraph(ctx context.Context) (compose.Runnable[map[string]any, *schema.Message], error) {
	return composeGraph[map[string]any, *schema.Message](
		ctx,
		newChatTemplate(ctx),
		newChatModel(ctx),
		newToolsNode(ctx),
		newMyStore(ctx, s.baseDir),
	)
}

// RunServer is the main entry point for the web server
func RunServer(port int, baseDir, distDir string) error {
	cfg := DefaultConfig()
	if port > 0 {
		cfg.Port = port
	}
	if baseDir != "" {
		cfg.BaseDir = baseDir
	}
	if distDir != "" {
		cfg.DistDir = distDir
	}

	server, err := NewServer(cfg)
	if err != nil {
		return fmt.Errorf("create server: %w", err)
	}

	return server.Run()
}
