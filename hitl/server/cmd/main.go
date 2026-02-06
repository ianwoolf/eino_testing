package main

import (
	"log"

	"eino_testing/hitl/server"
)

func main() {
	// 启动 Web 服务器
	if err := server.RunServer(8080, "./checkpoints_data", "./ui/dist"); err != nil {
		log.Fatal(err)
	}
}
