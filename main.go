package main

import (
	"context"
	"log"

	"eino_testing/agent"
	"eino_testing/chat"
	"eino_testing/workflow"

	"github.com/joho/godotenv"
)

func test_chat() {
	chat.ChatGenerate()
}
func test_agent() {
	agent.SimpleAgent() // qwen1.5-1.8b is not good enough, result is not stable. qwen1.5-14b is better.
}

func test_workflow() {
	ctx := context.Background()
	workflow.OrcGraphWithModel(ctx, map[string]string{"role": "cute", "content": "你好啊"})
	workflow.OrcGraphWithState(ctx, map[string]string{"role": "cute", "content": "你好啊"})
	workflow.OrcGraphWithCallback(ctx, map[string]string{"role": "cute", "content": "你好啊"})
}

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	// test_chat()
	test_agent()
	// test_workflow()

	//r, err := stage10.Buildtest(ctx)
	//if err != nil {
	//	panic(err)
	//}
	//variables := map[string]any{
	//	"role": "可爱的女子高中生",
	//	"task": "安慰一下我",
	//}
	//output, err := r.Invoke(ctx, variables)
	//if err != nil {
	//	panic(err)
	//}
	//fmt.Println(output)
}
