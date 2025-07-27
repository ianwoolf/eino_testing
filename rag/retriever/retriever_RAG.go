package retriever

import (
	"context"
	"os"
	"time"

	"eino_testing/rag/indexer"

	"github.com/cloudwego/eino-ext/components/embedding/ark"
	"github.com/cloudwego/eino-ext/components/retriever/milvus"
	"github.com/cloudwego/eino/schema"
)

func RetrieverRAG(CollectionName, query string) []*schema.Document {
	ctx := context.Background()
	timeout := 30 * time.Second
	embedder, err := ark.NewEmbedder(ctx, &ark.EmbeddingConfig{
		APIKey:  os.Getenv("ARK_API_KEY"),
		Model:   os.Getenv("EMBEDDER"),
		BaseURL: os.Getenv("API_URL"),
		Timeout: &timeout,
	})
	if err != nil {
		panic(err)
	}
	retriever, err := milvus.NewRetriever(ctx, &milvus.RetrieverConfig{
		Client:      indexer.MilvusCli,
		Collection:  CollectionName,
		Partition:   nil,
		VectorField: "vector",
		OutputFields: []string{
			"id",
			"content",
			"metadata",
		},
		TopK:      1,
		Embedding: embedder,
	})
	if err != nil {
		panic(err)
	}

	results, err := retriever.Retrieve(ctx, query)
	if err != nil {
		panic(err)
	}

	return results
}
