#!/usr/bin/env python3
"""
Embedding Generator for RAG System
Generates vector embeddings for knowledge chunks using sentence-transformers

Model: sentence-transformers/all-MiniLM-L6-v2
- 384-dimensional embeddings
- ~80MB model size
- Optimized for semantic search

Usage:
    python generate_embeddings.py

Output:
    - knowledge_base/embeddings.npy: Vector embeddings (numpy array)
    - knowledge_base/embedding_metadata.json: Embedding configuration
"""

import json
import numpy as np
from pathlib import Path
from typing import List, Dict
import time


class EmbeddingGenerator:
    """Generates embeddings for knowledge chunks"""

    MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DIM = 384

    def __init__(self, chunks_path: str, output_dir: str):
        self.chunks_path = Path(chunks_path)
        self.output_dir = Path(output_dir)

        self.chunks = []
        self.embeddings = None
        self.model = None

    def load_chunks(self):
        """Load knowledge chunks from JSON"""
        print(f"📖 Loading chunks from: {self.chunks_path}")

        with open(self.chunks_path, 'r', encoding='utf-8') as f:
            self.chunks = json.load(f)

        print(f"✅ Loaded {len(self.chunks)} chunks")

    def initialize_model(self):
        """Initialize sentence-transformers model"""
        print(f"🤖 Initializing model: {self.MODEL_NAME}")

        try:
            from sentence_transformers import SentenceTransformer

            self.model = SentenceTransformer(self.MODEL_NAME)
            print(f"✅ Model loaded successfully")
            print(f"   Embedding dimension: {self.EMBEDDING_DIM}")

        except ImportError:
            print("❌ sentence-transformers not installed")
            print("   Install with: pip install sentence-transformers")
            raise

    def prepare_texts(self) -> List[str]:
        """Prepare texts for embedding generation

        Combines question and content for better semantic representation
        """
        texts = []

        for chunk in self.chunks:
            # Combine question and content for richer semantic representation
            # Format: "Q: {question} A: {content}"
            question = chunk.get("question", "")
            content = chunk.get("content", "")

            # Create combined text
            text = f"Q: {question}\nA: {content}"
            texts.append(text)

        return texts

    def generate_embeddings(self, batch_size: int = 32):
        """Generate embeddings for all chunks

        Args:
            batch_size: Number of texts to embed at once (higher = faster but more memory)
        """
        print(f"🔄 Generating embeddings (batch_size={batch_size})...")

        texts = self.prepare_texts()

        start_time = time.time()

        # Generate embeddings with progress
        self.embeddings = self.model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=True,
            convert_to_numpy=True,
            normalize_embeddings=True  # Normalize for cosine similarity
        )

        elapsed = time.time() - start_time

        print(f"✅ Generated {len(self.embeddings)} embeddings")
        print(f"   Shape: {self.embeddings.shape}")
        print(f"   Time: {elapsed:.2f}s ({elapsed/len(self.embeddings)*1000:.2f}ms per embedding)")

    def save_embeddings(self):
        """Save embeddings to numpy file"""
        output_path = self.output_dir / "embeddings.npy"

        np.save(output_path, self.embeddings)

        # Calculate file size
        file_size_mb = output_path.stat().st_size / (1024 * 1024)

        print(f"💾 Saved embeddings to: {output_path}")
        print(f"   File size: {file_size_mb:.2f} MB")

    def save_metadata(self):
        """Save embedding configuration and metadata"""
        metadata_path = self.output_dir / "embedding_metadata.json"

        metadata = {
            "model_name": self.MODEL_NAME,
            "embedding_dim": self.EMBEDDING_DIM,
            "num_embeddings": len(self.embeddings),
            "normalization": "L2 normalized for cosine similarity",
            "text_format": "Q: {question}\\nA: {content}",
            "chunks_source": str(self.chunks_path.name),
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }

        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)

        print(f"📋 Saved metadata to: {metadata_path}")

    def verify_embeddings(self):
        """Verify embeddings are valid"""
        print("🔍 Verifying embeddings...")

        # Check shape
        expected_shape = (len(self.chunks), self.EMBEDDING_DIM)
        assert self.embeddings.shape == expected_shape, \
            f"Shape mismatch: {self.embeddings.shape} != {expected_shape}"

        # Check normalization (should be ~1.0 for normalized vectors)
        norms = np.linalg.norm(self.embeddings, axis=1)
        avg_norm = np.mean(norms)
        assert 0.99 < avg_norm < 1.01, \
            f"Vectors not properly normalized: avg norm = {avg_norm}"

        # Check for NaN or Inf
        assert not np.isnan(self.embeddings).any(), "Found NaN values"
        assert not np.isinf(self.embeddings).any(), "Found Inf values"

        print(f"✅ Verification passed")
        print(f"   Average L2 norm: {avg_norm:.6f}")

    def run(self, batch_size: int = 32):
        """Execute the full pipeline"""
        print("🚀 Starting Embedding Generation...")
        print()

        self.load_chunks()
        self.initialize_model()
        self.generate_embeddings(batch_size=batch_size)
        self.verify_embeddings()
        self.save_embeddings()
        self.save_metadata()

        print()
        print("✅ Embedding generation complete!")


def main():
    """Main entry point"""
    # Paths relative to script location
    script_dir = Path(__file__).parent
    chunks_path = script_dir / "knowledge_base" / "chunks.json"
    output_dir = script_dir / "knowledge_base"

    generator = EmbeddingGenerator(
        chunks_path=str(chunks_path),
        output_dir=str(output_dir)
    )

    # Run with batch_size=32 for good balance of speed and memory
    generator.run(batch_size=32)


if __name__ == "__main__":
    main()