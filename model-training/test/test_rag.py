#!/usr/bin/env python3
"""
RAG Test Script - Retrieval-Augmented Generation Demo
Tests the fine-tuned Qwen model with RAG using role-specific embeddings.
"""

import json
import time
import argparse
from pathlib import Path
from typing import List, Dict, Tuple

import numpy as np
import torch
from sentence_transformers import SentenceTransformer
from transformers import AutoTokenizer, AutoModelForCausalLM


# Configuration
BASE_PATH = Path("/Users/serhiihrudakov/Documents/Code/FE/portfolio")
EMBEDDINGS_PATH = BASE_PATH / "public/data"
MODEL_PATH = BASE_PATH / "model-training/serhii-qwen-lora-v2"

ROLE_DESCRIPTIONS = {
    "hr": "You are Serhii Hrudakov. You are speaking to a Recruiter (HR). Focus on leadership, business impact, and professional growth.",
    "developer": "You are Serhii Hrudakov. You are speaking to a Senior Engineer. Focus on technical details, architecture, and problem-solving.",
    "friend": "You are Serhii Hrudakov. You are speaking to a Friend. Be casual and personal."
}


class RAGTester:
    """Handles RAG testing with embeddings and fine-tuned model."""

    def __init__(self, verbose: bool = False):
        """Initialize RAG tester with models."""
        self.verbose = verbose
        self.embedding_model = None
        self.tokenizer = None
        self.llm_model = None

    def log(self, message: str):
        """Print message if verbose mode is enabled."""
        if self.verbose:
            print(f"[DEBUG] {message}")

    def load_embedding_model(self):
        """Load sentence-transformers model for generating embeddings."""
        self.log("Loading sentence-transformers model...")
        self.embedding_model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        self.log("Embedding model loaded successfully")

    def load_embeddings(self, role: str) -> List[Dict]:
        """Load role-specific embeddings from JSON file."""
        valid_roles = ["hr", "developer", "friend"]
        if role not in valid_roles:
            raise ValueError(f"Invalid role '{role}'. Must be one of: {valid_roles}")

        file_path = EMBEDDINGS_PATH / f"embeddings-{role}.json"

        if not file_path.exists():
            raise FileNotFoundError(f"Embeddings file not found: {file_path}")

        self.log(f"Loading embeddings from {file_path}...")
        with open(file_path, 'r') as f:
            chunks = json.load(f)

        self.log(f"Loaded {len(chunks)} chunks for role '{role}'")
        return chunks

    def generate_query_embedding(self, query: str) -> np.ndarray:
        """Generate L2-normalized embedding for query."""
        if self.embedding_model is None:
            raise RuntimeError("Embedding model not loaded. Call load_embedding_model() first.")

        if not query.strip():
            raise ValueError("Query cannot be empty")

        self.log(f"Generating embedding for query: '{query[:50]}...'")
        embedding = self.embedding_model.encode(query, normalize_embeddings=True)
        self.log(f"Generated embedding with {len(embedding)} dimensions")

        return embedding

    def cosine_similarity(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """Calculate cosine similarity between two vectors."""
        # Since embeddings are already L2-normalized, cosine similarity = dot product
        return float(np.dot(vec1, vec2))

    def find_top_chunks(
        self,
        query_embedding: np.ndarray,
        chunks: List[Dict],
        top_k: int = 5,
        threshold: float = 0.7
    ) -> List[Dict]:
        """Find top-K most similar chunks above similarity threshold."""
        self.log(f"Searching for top {top_k} chunks with threshold {threshold}...")

        results = []
        for chunk in chunks:
            chunk_embedding = np.array(chunk['embedding'])
            similarity = self.cosine_similarity(query_embedding, chunk_embedding)

            if similarity >= threshold:
                results.append({
                    'chunk': chunk,
                    'similarity': similarity
                })

        # Sort by similarity descending
        results.sort(key=lambda x: x['similarity'], reverse=True)

        self.log(f"Found {len(results)} chunks above threshold, returning top {top_k}")
        return results[:top_k]

    def build_rag_context(self, retrieved_chunks: List[Dict]) -> str:
        """Build context from retrieved chunks. Uses only top 1 chunk to avoid confusion."""
        if not retrieved_chunks:
            return ""

        # Use only the top 1 chunk (highest similarity) for clearest signal
        result = retrieved_chunks[0]
        chunk = result['chunk']
        similarity = result['similarity']

        context = f"[Most Relevant Context] (Similarity: {similarity:.3f})\n{chunk['text']}"

        self.log(f"Built RAG context from top 1 chunk with {len(context)} characters (similarity: {similarity:.3f})")

        return context

    def load_finetuned_model(self):
        """Load locally trained Qwen model."""
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Model not found at {MODEL_PATH}")

        self.log(f"Loading fine-tuned model from {MODEL_PATH}...")

        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
        self.llm_model = AutoModelForCausalLM.from_pretrained(
            MODEL_PATH,
            dtype=torch.float32,
            device_map="auto"
        )

        self.log("Fine-tuned model loaded successfully")

    def generate_response(
        self,
        query: str,
        role: str,
        context: str = "",
        max_tokens: int = 200,
        temperature: float = 0.7
    ) -> Tuple[str, float]:
        """Generate response using fine-tuned model with optional RAG context."""
        if self.tokenizer is None or self.llm_model is None:
            raise RuntimeError("LLM model not loaded. Call load_finetuned_model() first.")

        # Build messages
        system_message = ROLE_DESCRIPTIONS.get(role, ROLE_DESCRIPTIONS["hr"])

        if context:
            # With RAG context: strict instruction to only use provided information
            user_message = f"""Context:
{context}

Question: {query}

IMPORTANT: Answer using ONLY the information provided in the Context above. Do not add any information that is not explicitly stated in the Context. If the Context doesn't contain enough information to answer the question, say "I don't have enough information about that in my experience."""
        else:
            # No RAG context: instruct to say can't find information
            user_message = f"""{query}

IMPORTANT: If you don't have specific information about this topic from your actual experience, respond with "I can't find such information in my experience." Do not make up details."""

        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message}
        ]

        # Format using chat template
        input_text = self.tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True
        )

        # Tokenize and generate
        inputs = self.tokenizer(input_text, return_tensors="pt").to(self.llm_model.device)

        start_time = time.time()

        with torch.no_grad():
            outputs = self.llm_model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                temperature=temperature,
                top_p=0.9,
                do_sample=True,
                pad_token_id=self.tokenizer.eos_token_id
            )

        generation_time = time.time() - start_time

        # Decode response
        response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)

        # Extract assistant response (after last "assistant" marker)
        if "assistant" in response:
            response = response.split("assistant")[-1].strip()

        self.log(f"Generated response in {generation_time:.2f}s")

        return response, generation_time

    def display_results(
        self,
        query: str,
        role: str,
        query_embedding: np.ndarray,
        retrieved_chunks: List[Dict],
        rag_context: str,
        rag_response: str,
        rag_time: float,
        baseline_response: str,
        baseline_time: float
    ):
        """Display formatted results."""
        print("=" * 80)
        print("RAG TEST SCRIPT - Retrieval-Augmented Generation")
        print("=" * 80)
        print()

        # Query Information
        print("QUERY INFORMATION")
        print("-" * 80)
        print(f"Query: \"{query}\"")
        print(f"Role: {role}")
        print(f"Query embedding dimensions: {len(query_embedding)}")
        print()

        # Retrieved Chunks
        print(f"RETRIEVED CHUNKS (Top {len(retrieved_chunks)})")
        print("-" * 80)

        if not retrieved_chunks:
            print("No chunks found above similarity threshold")
        else:
            for i, result in enumerate(retrieved_chunks, 1):
                chunk = result['chunk']
                similarity = result['similarity']
                metadata = chunk.get('metadata', {})

                print(f"[{i}] Similarity: {similarity:.3f}")
                print(f"    ID: {chunk.get('id', 'N/A')}")
                print(f"    Category: {metadata.get('category', 'N/A')}")
                print(f"    Company: {metadata.get('company', 'N/A')}")

                # Show first 100 characters of text
                text_preview = chunk['text'][:100]
                if len(chunk['text']) > 100:
                    text_preview += "..."
                print(f"    Text: \"{text_preview}\"")
                print()

        # RAG Context
        print("RAG CONTEXT")
        print("-" * 80)
        print(f"Total chunks: {len(retrieved_chunks)}")
        print(f"Total context length: {len(rag_context):,} characters")
        print()

        if rag_context:
            print("Context passed to model:")
            print(rag_context)
            print()

        # Model Response with RAG
        print("MODEL RESPONSE (WITH RAG)")
        print("-" * 80)
        print(f"Response time: {rag_time:.2f}s")
        print()
        print(rag_response)
        print()

        # Baseline Response without RAG
        print("BASELINE RESPONSE (WITHOUT RAG)")
        print("-" * 80)
        print(f"Response time: {baseline_time:.2f}s")
        print()
        print(baseline_response)
        print()

        # Comparison
        print("COMPARISON")
        print("-" * 80)
        print(f"RAG response length: {len(rag_response)} characters")
        print(f"Baseline response length: {len(baseline_response)} characters")
        print(f"Context provided: {len(retrieved_chunks)} chunks")
        print("=" * 80)

    def run_test(
        self,
        query: str,
        role: str = "hr",
        top_k: int = 5,
        similarity_threshold: float = 0.7,
        max_tokens: int = 200,
        temperature: float = 0.7
    ):
        """Run complete RAG test."""
        # Step 1: Load models if not already loaded
        if self.embedding_model is None:
            self.load_embedding_model()

        if self.tokenizer is None or self.llm_model is None:
            self.load_finetuned_model()

        # Step 2: Load role-specific embeddings
        chunks = self.load_embeddings(role)

        # Step 3: Generate query embedding
        query_embedding = self.generate_query_embedding(query)

        # Step 4: Find similar chunks
        retrieved_chunks = self.find_top_chunks(
            query_embedding,
            chunks,
            top_k=top_k,
            threshold=similarity_threshold
        )

        # Step 5: Build RAG context
        rag_context = self.build_rag_context(retrieved_chunks)

        # Step 6: Generate response with RAG
        # If no chunks found, force the "can't find information" response
        if not rag_context:
            rag_response = "I can't find such information in my experience."
            rag_time = 0.0
        else:
            # Use lower temperature (0.3) for RAG to reduce hallucination
            rag_response, rag_time = self.generate_response(
                query,
                role,
                context=rag_context,
                max_tokens=max_tokens,
                temperature=0.3  # Lower temperature for factual accuracy
            )

        # Step 7: Generate baseline response (no RAG)
        baseline_response, baseline_time = self.generate_response(
            query,
            role,
            context="",
            max_tokens=max_tokens,
            temperature=temperature
        )

        # Step 8: Display results
        self.display_results(
            query,
            role,
            query_embedding,
            retrieved_chunks,
            rag_context,
            rag_response,
            rag_time,
            baseline_response,
            baseline_time
        )


def main():
    """Main entry point for CLI."""
    parser = argparse.ArgumentParser(
        description="Test RAG (Retrieval-Augmented Generation) with fine-tuned Qwen model"
    )

    parser.add_argument(
        "query",
        type=str,
        help="Test query string (e.g., 'What was your impact at A-Dam?')"
    )

    parser.add_argument(
        "--role",
        type=str,
        choices=["hr", "developer", "friend"],
        default="hr",
        help="Role perspective for response (default: hr)"
    )

    parser.add_argument(
        "--top-k",
        type=int,
        default=5,
        help="Number of chunks to retrieve (default: 5)"
    )

    parser.add_argument(
        "--threshold",
        type=float,
        default=0.7,
        help="Minimum similarity threshold (default: 0.7)"
    )

    parser.add_argument(
        "--max-tokens",
        type=int,
        default=200,
        help="Maximum response length in tokens (default: 200)"
    )

    parser.add_argument(
        "--temperature",
        type=float,
        default=0.7,
        help="Sampling temperature (default: 0.7)"
    )

    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show detailed debug output"
    )

    args = parser.parse_args()

    try:
        tester = RAGTester(verbose=args.verbose)
        tester.run_test(
            query=args.query,
            role=args.role,
            top_k=args.top_k,
            similarity_threshold=args.threshold,
            max_tokens=args.max_tokens,
            temperature=args.temperature
        )
    except Exception as e:
        print(f"Error: {e}", file=__import__('sys').stderr)
        if args.verbose:
            import traceback
            traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
