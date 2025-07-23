package main

import (
	"context"
	"log"

	// "AwesomeEino/chat"
	// "AwesomeEino/text_processing"
	// "AwesomeEino/agent"
	"AwesomeEino/workflow"

	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	// chat.ChatGenerate()
	// text_processing.EmbedText()
	// text_processing.TransDoc()
	// agent.SimpleAgent() # qwen1.5-1.8b is not good enough, result is not stable. qwen1.5-14b is better.
	ctx := context.Background()
	workflow.OrcGraphWithModel(ctx, map[string]string{"role": "cute", "content": "你好啊"})
	workflow.OrcGraphWithState(ctx, map[string]string{"role": "cute", "content": "你好啊"})
	workflow.OrcGraphWithCallback(ctx, map[string]string{"role": "cute", "content": "你好啊"})

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
