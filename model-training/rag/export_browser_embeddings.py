#!/usr/bin/env python3
"""
Browser Embeddings Exporter

Converts Python-generated embeddings to browser-compatible JSON format
for static GitHub Pages deployment.

Expected output format (cv-data-service.js):
[
  {
    "id": "chunk_id",
    "text": "content text",
    "embedding": [0.123, 0.456, ..., 0.789]  // 384-dim array
  }
]

Usage:
    python export_browser_embeddings.py

Output:
    - ../public/data/embeddings-hr.json
    - ../public/data/embeddings-developer.json
    - ../public/data/embeddings-friend.json
"""

import json
import numpy as np
from pathlib import Path
from typing import List, Dict


class BrowserEmbeddingsExporter:
    """Export embeddings to browser-compatible JSON format"""

    # Role mapping from training categories to browser roles
    ROLE_MAPPING = {
        "hr": ["professional"],  # HR cares about professional content
        "developer": ["technical"],  # Developers care about technical content
        "friend": ["personal"]  # Friends care about personal content
    }

    def __init__(self, kb_dir: str, output_dir: str):
        self.kb_dir = Path(kb_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.chunks = []
        self.embeddings = None

    def load_data(self):
        """Load chunks and embeddings"""
        print("📖 Loading knowledge base...")

        # Load chunks
        chunks_path = self.kb_dir / "chunks.json"
        with open(chunks_path, 'r', encoding='utf-8') as f:
            self.chunks = json.load(f)

        # Load embeddings
        embeddings_path = self.kb_dir / "embeddings.npy"
        self.embeddings = np.load(embeddings_path)

        print(f"✅ Loaded {len(self.chunks)} chunks with embeddings")

    def filter_chunks_by_role(self, role: str) -> List[Dict]:
        """Filter chunks relevant to a specific role

        Args:
            role: Browser role (hr, developer, friend)

        Returns:
            List of filtered chunks with indices
        """
        relevant_categories = self.ROLE_MAPPING.get(role, [])

        filtered = []
        for i, chunk in enumerate(self.chunks):
            # Check if chunk category matches role
            chunk_category = chunk["category"]

            # Check if any relevant category is in the chunk's category
            is_relevant = any(
                cat in chunk_category
                for cat in relevant_categories
            )

            if is_relevant:
                filtered.append({
                    "chunk": chunk,
                    "index": i
                })

        return filtered

    def create_browser_chunk(self, chunk: Dict, embedding: np.ndarray) -> Dict:
        """Convert chunk to browser format

        Args:
            chunk: Original knowledge chunk
            embedding: Embedding vector

        Returns:
            Browser-compatible chunk
        """
        # Combine question and content as text (same format as embedding generation)
        text = f"Q: {chunk['question']}\nA: {chunk['content']}"

        return {
            "id": chunk["id"],
            "text": text,
            "embedding": embedding.tolist(),  # Convert numpy array to list
            # Optional metadata for debugging (not required by cv-data-service)
            "metadata": {
                "category": chunk["category"],
                "company": chunk["company"],
                "keywords": chunk["keywords"]
            }
        }

    def export_role(self, role: str):
        """Export embeddings for a specific role

        Args:
            role: Browser role (hr, developer, friend)
        """
        print(f"\n🔄 Exporting role: {role}")

        # Filter chunks for this role
        filtered = self.filter_chunks_by_role(role)

        if not filtered:
            print(f"   ⚠️  No chunks found for role '{role}'")
            return

        # Create browser-compatible chunks
        browser_chunks = []
        for item in filtered:
            chunk = item["chunk"]
            index = item["index"]
            embedding = self.embeddings[index]

            browser_chunk = self.create_browser_chunk(chunk, embedding)
            browser_chunks.append(browser_chunk)

        # Save to file
        output_path = self.output_dir / f"embeddings-{role}.json"

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(browser_chunks, f, indent=2, ensure_ascii=False)

        # Calculate file size
        file_size_mb = output_path.stat().st_size / (1024 * 1024)

        print(f"✅ Exported {len(browser_chunks)} chunks")
        print(f"   File: {output_path}")
        print(f"   Size: {file_size_mb:.2f} MB")

    def export_all_roles(self):
        """Export embeddings for all roles"""
        print("🚀 Exporting browser-compatible embeddings...")
        print(f"   Output directory: {self.output_dir}")

        for role in self.ROLE_MAPPING.keys():
            self.export_role(role)

        print("\n✅ Export complete!")

    def run(self):
        """Execute the full export pipeline"""
        self.load_data()
        self.export_all_roles()


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Export knowledge base embeddings to browser-compatible JSON format"
    )

    # Default paths
    script_dir = Path(__file__).parent
    default_kb_dir = script_dir / "knowledge_base"
    default_output_dir = script_dir.parent.parent / "public" / "data"

    parser.add_argument(
        "--kb-dir",
        type=str,
        default=str(default_kb_dir),
        help=f"Path to knowledge_base directory (default: {default_kb_dir})"
    )

    parser.add_argument(
        "--output-dir",
        type=str,
        default=str(default_output_dir),
        help=f"Path to output directory (default: {default_output_dir})"
    )

    args = parser.parse_args()

    print(f"Configuration:")
    print(f"  Knowledge Base: {args.kb_dir}")
    print(f"  Output Directory: {args.output_dir}")
    print()

    exporter = BrowserEmbeddingsExporter(
        kb_dir=args.kb_dir,
        output_dir=args.output_dir
    )

    exporter.run()


if __name__ == "__main__":
    main()