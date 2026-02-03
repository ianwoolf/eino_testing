package server

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
)

// HandleExecute starts a new execution
func (s *Server) HandleExecute(c *gin.Context) {
	var req ExecuteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIError{
			Error:   "Invalid request body",
			Details: err.Error(),
		})
		return
	}

	if req.Name == "" || req.Location == "" {
		c.JSON(http.StatusBadRequest, APIError{
			Error: "name and location are required",
		})
		return
	}

	input := map[string]any{
		"name":     req.Name,
		"location": req.Location,
	}

	checkpointID := fmt.Sprintf("exec-%d", time.Now().UnixNano())

	// Create runner
	runner, err := s.composeGraph(context.Background())
	if err != nil {
		log.Printf("[Handler] Failed to compose graph: %v", err)
		c.JSON(http.StatusInternalServerError, APIError{
			Error:   "Failed to create execution",
			Details: err.Error(),
		})
		return
	}

	// Create execution
	exec := s.execManager.CreateExecution(
		context.Background(),
		runner,
		checkpointID,
		input,
	)

	// Run execution asynchronously
	s.execManager.RunExecution(context.Background(), exec, s.hub, s.baseDir)

	c.JSON(http.StatusCreated, exec)
}

// HandleResume resumes an execution from checkpoint
func (s *Server) HandleResume(c *gin.Context) {
	execID := c.Param("id")

	exec, ok := s.execManager.GetExecution(execID)
	if !ok {
		c.JSON(http.StatusNotFound, APIError{Error: "Execution not found"})
		return
	}

	if exec.Status != "interrupted" {
		c.JSON(http.StatusBadRequest, APIError{
			Error: fmt.Sprintf("Cannot resume execution in status: %s", exec.Status),
		})
		return
	}

	// Update execution status
	s.execManager.UpdateExecutionState(execID, "running", "ChatModel", exec.State)

	// Run execution again
	s.execManager.RunExecution(context.Background(), exec, s.hub, s.baseDir)

	c.JSON(http.StatusOK, exec)
}

// HandleGetState gets the current state of an execution
func (s *Server) HandleGetState(c *gin.Context) {
	execID := c.Param("id")

	exec, ok := s.execManager.GetExecution(execID)
	if !ok {
		c.JSON(http.StatusNotFound, APIError{Error: "Execution not found"})
		return
	}

	var resp StateResponse
	if exec.State != nil {
		resp = stateToResponse(execID, exec.Status, exec.CurrentNode, exec.State, exec.Result, exec.Error)
	} else {
		resp = StateResponse{
			ExecutionID: execID,
			Status:      exec.Status,
			Context:     exec.Input,
			SavedAt:     exec.CreatedAt.UnixNano(),
			CurrentNode: exec.CurrentNode,
			Result:      exec.Result,
			Error:       exec.Error,
		}
	}

	c.JSON(http.StatusOK, resp)
}

// HandleConfirm handles tool call confirmation
func (s *Server) HandleConfirm(c *gin.Context) {
	var req ConfirmRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIError{
			Error:   "Invalid request body",
			Details: err.Error(),
		})
		return
	}

	exec, ok := s.execManager.GetExecution(req.ExecutionID)
	if !ok {
		c.JSON(http.StatusNotFound, APIError{Error: "Execution not found"})
		return
	}

	if exec.Status != "interrupted" {
		c.JSON(http.StatusBadRequest, APIError{
			Error: fmt.Sprintf("Cannot confirm execution in status: %s", exec.Status),
		})
		return
	}

	switch req.Action {
	case "confirm":
		// Save pending state for resume
		if exec.State != nil {
			if err := savePendingState(s.baseDir, exec.CheckpointID, exec.State); err != nil {
				log.Printf("[Handler] Failed to save pending state: %v", err)
				c.JSON(http.StatusInternalServerError, APIError{
					Error:   "Failed to save pending state",
					Details: err.Error(),
				})
				return
			}
		}
		c.JSON(http.StatusOK, gin.H{"status": "confirmed"})

	case "reject":
		if req.NewArgs == "" {
			c.JSON(http.StatusBadRequest, APIError{Error: "new_args required for reject action"})
			return
		}

		// Update tool call arguments
		if err := s.execManager.UpdateToolCalls(req.ExecutionID, req.NewArgs); err != nil {
			log.Printf("[Handler] Failed to update tool calls: %v", err)
			c.JSON(http.StatusInternalServerError, APIError{
				Error:   "Failed to update tool calls",
				Details: err.Error(),
			})
			return
		}

		// Update checkpoint arguments
		if err := updateCheckpointArguments(s.baseDir, exec.CheckpointID, req.NewArgs); err != nil {
			log.Printf("[Handler] Failed to update checkpoint: %v", err)
			c.JSON(http.StatusInternalServerError, APIError{
				Error:   "Failed to update checkpoint",
				Details: err.Error(),
			})
			return
		}

		// Save pending state
		if exec.State != nil {
			if err := savePendingState(s.baseDir, exec.CheckpointID, exec.State); err != nil {
				log.Printf("[Handler] Failed to save pending state: %v", err)
				c.JSON(http.StatusInternalServerError, APIError{
					Error:   "Failed to save pending state",
					Details: err.Error(),
				})
				return
			}
		}

		c.JSON(http.StatusOK, gin.H{"status": "rejected", "new_args": req.NewArgs})

	default:
		c.JSON(http.StatusBadRequest, APIError{Error: fmt.Sprintf("Unknown action: %s", req.Action)})
		return
	}
}

// HandleListCheckpoints lists all checkpoints
func (s *Server) HandleListCheckpoints(c *gin.Context) {
	checkpoints, err := listCheckpoints(s.baseDir)
	if err != nil {
		log.Printf("[Handler] Failed to list checkpoints: %v", err)
		c.JSON(http.StatusInternalServerError, APIError{
			Error:   "Failed to list checkpoints",
			Details: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, checkpoints)
}

// HandleDeleteCheckpoint deletes a checkpoint
func (s *Server) HandleDeleteCheckpoint(c *gin.Context) {
	id := c.Param("id")

	if err := deleteCheckpoint(s.baseDir, id); err != nil {
		log.Printf("[Handler] Failed to delete checkpoint: %v", err)
		c.JSON(http.StatusInternalServerError, APIError{
			Error:   "Failed to delete checkpoint",
			Details: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// HandleListExecutions lists all executions
func (s *Server) HandleListExecutions(c *gin.Context) {
	executions := s.execManager.ListExecutions()
	c.JSON(http.StatusOK, executions)
}

// HandleGetExecution gets a single execution
func (s *Server) HandleGetExecution(c *gin.Context) {
	id := c.Param("id")

	exec, ok := s.execManager.GetExecution(id)
	if !ok {
		c.JSON(http.StatusNotFound, APIError{Error: "Execution not found"})
		return
	}

	c.JSON(http.StatusOK, exec)
}

// HandleLogs streams execution logs (returns current state for now)
func (s *Server) HandleLogs(c *gin.Context) {
	execID := c.Param("id")

	exec, ok := s.execManager.GetExecution(execID)
	if !ok {
		c.JSON(http.StatusNotFound, APIError{Error: "Execution not found"})
		return
	}

	// Return execution info as logs
	logs := []map[string]any{
		{
			"timestamp": exec.CreatedAt.Format(time.RFC3339),
			"message":   fmt.Sprintf("Execution %s started", exec.ID),
			"level":     "info",
		},
	}

	if exec.State != nil {
		for node, logData := range exec.State.NodeExecutionLog {
			logs = append(logs, map[string]any{
				"timestamp": time.Unix(0, exec.State.SavedAt).Format(time.RFC3339),
				"message":   fmt.Sprintf("Node %s executed: %+v", node, logData),
				"level":     "info",
			})
		}
	}

	c.JSON(http.StatusOK, logs)
}

// Helper functions

func listCheckpoints(baseDir string) ([]CheckpointSummary, error) {
	var checkpoints []CheckpointSummary

	files, err := os.ReadDir(baseDir)
	if err != nil {
		if os.IsNotExist(err) {
			return checkpoints, nil
		}
		return nil, err
	}

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		name := file.Name()
		if filepath.Ext(name) == ".json" && !hasOverlaySuffix(name) {
			info, _ := file.Info()
			checkpointID := name[:len(name)-5] // Remove .json
			checkpoints = append(checkpoints, CheckpointSummary{
				ID:        checkpointID,
				CreatedAt: info.ModTime(),
				Size:      info.Size(),
			})
		}
	}

	return checkpoints, nil
}

func deleteCheckpoint(baseDir, id string) error {
	// Delete checkpoint file
	checkpointPath := filepath.Join(baseDir, id+".json")
	if err := os.Remove(checkpointPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete checkpoint file: %w", err)
	}

	// Delete overlay file if exists
	overlayPath := filepath.Join(baseDir, id+overlaySuffix)
	if err := os.Remove(overlayPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete overlay file: %w", err)
	}

	return nil
}

func hasOverlaySuffix(name string) bool {
	baseName := filepath.Base(name)
	return len(baseName) > len(overlaySuffix) && baseName[len(baseName)-len(overlaySuffix):] == overlaySuffix
}

// HandleServeStatic serves the frontend static files
func (s *Server) HandleServeStatic(c *gin.Context) {
	// Try to serve from dist directory
	path := c.Request.URL.Path
	if path == "/" {
		path = "/index.html"
	}

	filePath := filepath.Join(s.distDir, path)

	// Check if file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		// Fall back to index.html for SPA routing
		c.File(filepath.Join(s.distDir, "index.html"))
		return
	}

	c.File(filePath)
}

// HandleHealth returns health status
func (s *Server) HandleHealth(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "healthy",
		"time":   time.Now().Unix(),
	})
}

// HandleIndex redirects to the UI
func (s *Server) HandleIndex(c *gin.Context) {
	indexPath := filepath.Join(s.distDir, "index.html")
	if _, err := os.Stat(indexPath); os.IsNotExist(err) {
		c.JSON(http.StatusOK, gin.H{
			"message": "HITL Web Server is running",
			"version": "1.0.0",
		})
		return
	}
	c.File(indexPath)
}
