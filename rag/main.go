package main

import (
	"log"

	// "AwesomeEino/chat"
	// "text_processing"
	// "agent"

	"eino_testing/rag/indexer"
	"eino_testing/rag/retriever"
	"eino_testing/rag/text_processing"

	"github.com/joho/godotenv"
)

func save_doc() {
	docs := text_processing.TransDoc()
	indexer.IndexerRAG(docs)
}

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	// save_doc()
	results := retriever.RetrieverRAG(indexer.CollectionName, "欲渡黄河冰塞川")
	for _, doc := range results {
		println(doc.ID)
		println("================================================")
		println(doc.Content)
	}
}
