package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"eino_testing/multi_agent"

	"github.com/cloudwego/eino-ext/components/model/ark"
	"github.com/cloudwego/eino/flow/agent/multiagent/host"
	"github.com/cloudwego/eino/schema"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	cmConfig := &ark.ChatModelConfig{
		Model:   os.Getenv("MODEL"),
		BaseURL: os.Getenv("API_URL"),
		// Thinking: &model.Thinking{
		// 	Type: model.ThinkingTypeDisabled,
		// },
		// Timeout: &timeout,
	}
	if os.Getenv("ARK_API_KEY") != "" {
		cmConfig.APIKey = os.Getenv("ARK_API_KEY")
	}

	// 记录程序开始时间
	startTime := time.Now()
	fmt.Printf("程序开始执行时间: %s\n", startTime.Format("2006-01-02 15:04:05.000"))

	ctx := context.Background()
	h, err := multi_agent.NewHost(ctx, cmConfig)
	if err != nil {
		panic(err)
	}
	adder, err := multi_agent.NewAddSpecialist(ctx, cmConfig)
	if err != nil {
		panic(err)
	}
	suber, err := multi_agent.NewSubSpecialist(ctx, cmConfig)
	if err != nil {
		panic(err)
	}
	analyser, err := multi_agent.NewAnalyzeSpecialist(ctx, cmConfig, cmConfig)
	if err != nil {
		panic(err)
	}
	hostMA, err := host.NewMultiAgent(ctx, &host.MultiAgentConfig{
		Host: *h,
		Specialists: []*host.Specialist{
			adder,
			suber,
			analyser,
		},
		Summarizer: &host.Summarizer{
			ChatModel:    h.ToolCallingModel,
			SystemPrompt: "请总结一下各个专家的回答",
		},
	})
	if err != nil {
		panic(err)
	}
	cb := &logCallback{}
	msg := &schema.Message{
		Role:    schema.User,
		Content: "先帮我计算1239+231-222，然后分析一下这个问题的难度",
	}
	out, err := hostMA.Generate(ctx, []*schema.Message{msg}, host.WithAgentCallbacks(cb))
	if err != nil {
		panic(err)
	}
	println(out.Content)

	// 计算并打印运行时间
	endTime := time.Now()
	duration := endTime.Sub(startTime)
	fmt.Printf("\n程序结束执行时间: %s\n", endTime.Format("2006-01-02 15:04:05.000"))
	fmt.Printf("总运行时间: %v\n", duration)
	fmt.Printf("总运行时间(毫秒): %.2f ms\n", float64(duration.Nanoseconds())/1000000)

}

type logCallback struct{}

func (l *logCallback) OnHandOff(ctx context.Context, info *host.HandOffInfo) context.Context {
	println("\nHandOff to", info.ToAgentName, "with argument", info.Argument)
	return ctx
}
