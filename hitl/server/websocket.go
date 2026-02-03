package server

import (
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in development
	},
}

// WSMessage represents a WebSocket message
type WSMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

// WSClient represents a WebSocket client
type WSClient struct {
	ID     string
	Conn   *websocket.Conn
	Send   chan WSMessage
	Hub    *WSHub
 ExecID string
}

// WSHub manages WebSocket connections
type WSHub struct {
	clients    map[string][]*WSClient // execID -> clients
	register   chan *WSClient
	unregister chan *WSClient
	broadcast  chan WSMessage
	mu         sync.RWMutex
}

// NewWSHub creates a new WebSocket hub
func NewWSHub() *WSHub {
	return &WSHub{
		clients:    make(map[string][]*WSClient),
		register:   make(chan *WSClient),
		unregister: make(chan *WSClient),
		broadcast:  make(chan WSMessage),
	}
}

// Run starts the hub's message processing loop
func (h *WSHub) Run() {
	go func() {
		for {
			select {
			case client := <-h.register:
				h.mu.Lock()
				h.clients[client.ExecID] = append(h.clients[client.ExecID], client)
				h.mu.Unlock()
				log.Printf("[WSHub] Client %s registered for execution %s", client.ID, client.ExecID)

			case client := <-h.unregister:
				h.mu.Lock()
				clients := h.clients[client.ExecID]
				for i, c := range clients {
					if c == client {
						h.clients[client.ExecID] = append(clients[:i], clients[i+1:]...)
						break
					}
				}
				if len(h.clients[client.ExecID]) == 0 {
					delete(h.clients, client.ExecID)
				}
				h.mu.Unlock()
				close(client.Send)
				log.Printf("[WSHub] Client %s unregistered from execution %s", client.ID, client.ExecID)

			case message := <-h.broadcast:
				// Broadcast to all clients or specific execution
				h.mu.RLock()
				var targetClients []*WSClient

				// Try to extract execution_id from message data
				var execID string
				if dataMap, ok := message.Data.(map[string]interface{}); ok {
					if id, ok := dataMap["execution_id"].(string); ok {
						execID = id
					}
				}

				if execID != "" {
					targetClients = h.clients[execID]
				} else {
					// Broadcast to all clients
					for _, clients := range h.clients {
						targetClients = append(targetClients, clients...)
					}
				}
				h.mu.RUnlock()

				for _, client := range targetClients {
					select {
					case client.Send <- message:
					default:
						close(client.Send)
						h.unregister <- client
					}
				}
			}
		}
	}()
}

// Broadcast sends a message to all clients subscribed to an execution
func (h *WSHub) Broadcast(execID string, event interface{}) {
	message := WSMessage{
		Type: "update",
		Data: event,
	}

	// Add execution ID to event data if it's a WebSocketEvent
	if evt, ok := event.(WebSocketEvent); ok {
		dataMap, ok := evt.Data.(map[string]interface{})
		if !ok {
			// Try to convert to map
			b, _ := json.Marshal(evt.Data)
			json.Unmarshal(b, &dataMap)
		}
		if dataMap != nil {
			if dataMap["ID"] == nil {
				dataMap["execution_id"] = execID
			}
			message.Data = map[string]interface{}{
				"type": evt.Type,
				"data": dataMap,
				"timestamp": evt.Timestamp,
			}
		}
	}

	select {
	case h.broadcast <- message:
	default:
		log.Printf("[WSHub] Broadcast channel full, dropping message")
	}
}

// ReadPump pumps messages from the WebSocket connection to the hub
func (c *WSClient) ReadPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[WSClient %s] WebSocket error: %v", c.ID, err)
			}
			break
		}

		// Handle incoming messages if needed
		log.Printf("[WSClient %s] Received message: %s", c.ID, string(message))
	}
}

// WritePump pumps messages from the hub to the WebSocket connection
func (c *WSClient) WritePump() {
	defer c.Conn.Close()

	for {
		select {
		case message, ok := <-c.Send:
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			// Set write deadline (10 seconds)
			// c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteJSON(message); err != nil {
				log.Printf("[WSClient %s] Write error: %v", c.ID, err)
				return
			}
		}
	}
}

// HandleWebSocket handles WebSocket connections
func (s *Server) HandleWebSocket(c *gin.Context) {
	execID := c.Param("id")
	if execID == "" {
		c.JSON(http.StatusBadRequest, APIError{Error: "execution ID required"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[WS] Failed to upgrade connection: %v", err)
		return
	}

	client := &WSClient{
		ID:     generateClientID(),
		Conn:   conn,
		Send:   make(chan WSMessage, 256),
		Hub:    s.hub,
		ExecID: execID,
	}

	client.Hub.register <- client

	go client.ReadPump()
	go client.WritePump()
}

func generateClientID() string {
	return "client-" + randomString(8)
}

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

func init() {
	rand.Seed(time.Now().UnixNano())
}
