export interface DocumentChunk {
  content: string;
  index: number;
}

export function chunkDocument(text: string, chunkSize: number = 500): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];

  // Split by sentences first to avoid breaking mid-sentence
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

  let currentChunk = '';
  let chunkIndex = 0;

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim() + '.';

    // If adding this sentence would exceed chunk size, save current chunk
    if (currentChunk.length + trimmedSentence.length > chunkSize && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex
      });

      currentChunk = trimmedSentence + ' ';
      chunkIndex++;
    } else {
      currentChunk += trimmedSentence + ' ';
    }
  }

  // Add the last chunk if it has content
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunkIndex
    });
  }

  return chunks;
}