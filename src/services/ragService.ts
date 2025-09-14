import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
import { supabase } from "../lib/supabase";

// Initialize embeddings with Xenova (client-side)
const embeddings = new HuggingFaceTransformersEmbeddings({
  model: "Xenova/all-MiniLM-L6-v2",
});

// Text splitter for document chunking
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50,
});

export async function processAndStoreDocument(file: File): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.log("User not authenticated - skipping vector storage");
      return;
    }

    // Load PDF using LangChain
    const loader = new WebPDFLoader(file);
    const docs = await loader.load();

    // Split documents into chunks
    const splitDocs = await textSplitter.splitDocuments(docs);

    // Add metadata
    const docsWithMetadata = splitDocs.map(doc => ({
      ...doc,
      metadata: {
        ...doc.metadata,
        file_name: file.name,
        user_id: user.id
      }
    }));

    // Store in Supabase vector store
    const vectorStore = new SupabaseVectorStore(embeddings, {
      client: supabase,
      tableName: "vector_documents",
      queryName: "match_documents",
    });

    await vectorStore.addDocuments(docsWithMetadata);
    console.log(`Stored ${splitDocs.length} chunks for ${file.name}`);

  } catch (error) {
    console.error("Error processing document with LangChain:", error);
    // Don't throw - this is supplementary to existing storage
  }
}

export async function searchDocuments(query: string): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Fallback: get documents from sessionStorage for anonymous users
      const tempDocs = JSON.parse(sessionStorage.getItem('temporaryDocuments') || '[]');
      if (tempDocs.length === 0) return "";

      const context = tempDocs
        .map((doc: any) => `Document: ${doc.file_name}\n${doc.content}`)
        .join("\n\n");

      return `User's Documents:\n\n${context}`;
    }

    const vectorStore = new SupabaseVectorStore(embeddings, {
      client: supabase,
      tableName: "vector_documents",
      queryName: "match_documents",
    });

    // Search for relevant chunks
    const results = await vectorStore.similaritySearch(query, 5, {
      user_id: user.id
    });

    // Format results as context
    if (results.length === 0) return "";

    const context = results
      .map(doc => `Document: ${doc.metadata.file_name}\n${doc.pageContent}`)
      .join("\n\n");

    return `User's Documents:\n\n${context}`;

  } catch (error) {
    console.error("Error searching documents:", error);
    return "";
  }
}