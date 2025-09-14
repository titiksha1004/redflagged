import { supabase } from '../lib/supabase';
import { generateEmbedding } from './embeddingService';

export interface SearchResult {
  file_name: string;
  chunk_content: string;
  similarity: number;
}

export async function searchUserDocuments(query: string): Promise<SearchResult[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return []; // No vector search for anonymous users
    }

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Use the SQL function we created
    const { data, error } = await supabase.rpc('search_documents', {
      query_embedding: queryEmbedding,
      search_user_id: user.id,
      match_threshold: 0.5, // Lower threshold for more results
      match_count: 5
    });

    if (error) {
      console.error('Vector search error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in searchUserDocuments:', error);
    return [];
  }
}