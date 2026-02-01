package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"eino_testing/debug"

	"github.com/cloudwego/eino-ext/devops"
	"github.com/joho/godotenv"
)

func main() {
	ctx := context.Background()

	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	// Init eino devops server
	err = devops.Init(ctx)
	if err != nil {
		log.Printf("[eino dev] init failed, err=%v", err)
		return
	}

	// Register chain, graph and state_graph for demo use
	_, err = debug.Buildtest(ctx)
	if err != nil {
		log.Printf("[eino dev] build test failed, err=%v", err)
		return
	}
	// Blocking process exits
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	<-sigs

	// Exit
	log.Printf("[eino dev] shutting down\n")
}
