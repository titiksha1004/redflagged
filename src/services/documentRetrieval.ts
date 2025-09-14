import { supabase } from '../lib/supabase';

export interface UserDocument {
  id: string;
  content: string;
  file_name: string;
}

export async function getUserDocuments(): Promise<UserDocument[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Get documents from session storage for anonymous users
      const tempDocuments = JSON.parse(sessionStorage.getItem('temporaryDocuments') || '[]');
      return tempDocuments.map((doc: any) => ({
        id: doc.id,
        content: doc.content,
        file_name: doc.file_name
      }));
    }

    // Get documents from Supabase for authenticated users
    const { data, error } = await supabase
      .from('processed_documents')
      .select('id, content, file_name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user documents:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getUserDocuments:', error);
    return [];
  }
}

export function prepareDocumentContext(documents: UserDocument[]): string {
  if (documents.length === 0) {
    return '';
  }

  let context = "User's Documents:\n\n";
  let totalLength = 0;
  const maxContextLength = 6000; // Keep context reasonable for token limits

  for (const doc of documents) {
    const docContent = `Document: ${doc.file_name}\n${doc.content}\n\n`;

    if (totalLength + docContent.length > maxContextLength) {
      // Truncate this document to fit remaining space
      const remainingSpace = maxContextLength - totalLength;
      if (remainingSpace > 100) { // Only add if we have meaningful space left
        context += `Document: ${doc.file_name}\n${doc.content.substring(0, remainingSpace - 50)}...\n\n`;
      }
      break;
    }

    context += docContent;
    totalLength += docContent.length;
  }

  return context;
}