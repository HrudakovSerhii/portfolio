#!/usr/bin/env python3
"""
Knowledge Base Creator for RAG System
Transforms cv-training-data.jsonl into structured knowledge chunks

Usage:
    python create_knowledge_base.py

Output:
    - rag/knowledge_base/chunks.json: Structured fact chunks
    - rag/knowledge_base/chunks_stats.json: Statistics about the chunks
"""

import json
import re
from pathlib import Path
from typing import List, Dict, Set
from collections import defaultdict


class KnowledgeBaseCreator:
    """Converts training JSONL to structured knowledge chunks"""

    # Category mapping based on system message role
    ROLE_CATEGORY_MAP = {
        "Recruiter (HR)": "professional",
        "Senior Engineer": "technical",
        "Friend": "personal"
    }

    # Company names to extract
    COMPANIES = {
        "Hexaware", "Mobiquity", "EriksDigital", "A-Dam", "DigitalChefs",
        "ABiggerCircle", "IT-Transit", "Luxoft", "Nestle", "Purina"
    }

    # Technology keywords to extract
    TECH_KEYWORDS = {
        "NextJS", "React", "TypeScript", "JavaScript", "GraphQL", "WebSocket",
        "Python", "LangChain", "LLM", "Playwright", "Tailwind", "SCSS",
        "Azure", "ExpressJS", "RestAPI", "Vite", "BackboneJS", "jQuery",
        "PHP", "Laravel", "Flex", "ActionScript", "WebAssembly", "SSR",
        "React Router", "Axios", "React Native", "Node.js", "FastAPI"
    }

    def __init__(self, input_path: str, output_dir: str):
        self.input_path = Path(input_path)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.chunks = []
        self.stats = defaultdict(int)

    def extract_role_from_system_message(self, system_content: str) -> str:
        """Extract the role (HR, Engineer, Friend) from system message"""
        if "Recruiter (HR)" in system_content:
            return "Recruiter (HR)"
        elif "Senior Engineer" in system_content:
            return "Senior Engineer"
        elif "Friend" in system_content:
            return "Friend"
        return "unknown"

    def extract_keywords(self, text: str) -> List[str]:
        """Extract relevant keywords from text"""
        keywords = set()

        # Extract companies
        for company in self.COMPANIES:
            if company.lower() in text.lower():
                keywords.add(company)

        # Extract technologies
        for tech in self.TECH_KEYWORDS:
            if tech.lower() in text.lower():
                keywords.add(tech)

        # Extract numbers/metrics (like "100%", "5x", "75%")
        metrics = re.findall(r'\d+[%x]|\d+\s*years?', text, re.IGNORECASE)
        keywords.update(metrics)

        # Extract quoted terms (often important)
        quoted = re.findall(r'"([^"]+)"', text)
        keywords.update([q for q in quoted if len(q) < 30])

        return sorted(list(keywords))

    def categorize_chunk(self, role: str, content: str) -> str:
        """Determine specific category based on content"""
        base_category = self.ROLE_CATEGORY_MAP.get(role, "general")

        # Refine category based on content
        content_lower = content.lower()

        if base_category == "technical":
            if any(word in content_lower for word in ["architecture", "stack", "built", "developed"]):
                return "technical_project"
            elif any(word in content_lower for word in ["test", "testing", "playwright"]):
                return "technical_testing"
            else:
                return "technical_general"

        elif base_category == "professional":
            if any(word in content_lower for word in ["revenue", "business", "impact", "retention"]):
                return "professional_impact"
            elif any(word in content_lower for word in ["team", "lead", "hire", "mentor"]):
                return "professional_leadership"
            elif any(word in content_lower for word in ["left", "join", "why"]):
                return "professional_career"
            else:
                return "professional_general"

        elif base_category == "personal":
            if any(word in content_lower for word in ["hik", "mountain", "alps", "dive"]):
                return "personal_outdoor"
            elif any(word in content_lower for word in ["book", "movie", "read"]):
                return "personal_interests"
            else:
                return "personal_general"

        return base_category

    def extract_company_from_content(self, content: str) -> str | None:
        """Extract company name from content"""
        for company in self.COMPANIES:
            if company.lower() in content.lower():
                return company
        return None

    def create_chunk_id(self, index: int, category: str, company: str | None) -> str:
        """Generate unique chunk ID"""
        parts = [category]
        if company:
            parts.append(company.lower().replace(" ", "_"))
        parts.append(f"chunk_{index}")
        return "_".join(parts)

    def process_entry(self, entry: Dict, index: int) -> Dict | None:
        """Convert a single JSONL entry to a knowledge chunk"""
        try:
            messages = entry.get("messages", [])

            # Extract system, user, and assistant messages
            system_msg = next((m["content"] for m in messages if m["role"] == "system"), "")
            user_msg = next((m["content"] for m in messages if m["role"] == "user"), "")
            assistant_msg = next((m["content"] for m in messages if m["role"] == "assistant"), "")

            if not assistant_msg:
                return None

            # Extract metadata
            role = self.extract_role_from_system_message(system_msg)
            category = self.categorize_chunk(role, assistant_msg)
            company = self.extract_company_from_content(assistant_msg)
            keywords = self.extract_keywords(assistant_msg)

            # Create chunk
            chunk = {
                "id": self.create_chunk_id(index, category, company),
                "category": category,
                "role": role,
                "question": user_msg,
                "content": assistant_msg,
                "company": company,
                "keywords": keywords,
                "source_index": index
            }

            # Update stats
            self.stats["total_chunks"] += 1
            self.stats[f"category_{category}"] += 1
            self.stats[f"role_{role}"] += 1
            if company:
                self.stats[f"company_{company}"] += 1

            return chunk

        except Exception as e:
            print(f"❌ Error processing entry {index}: {e}")
            return None

    def process_all_entries(self):
        """Process all entries from JSONL file"""
        print(f"📖 Reading training data from: {self.input_path}")

        with open(self.input_path, 'r', encoding='utf-8') as f:
            for index, line in enumerate(f):
                try:
                    entry = json.loads(line.strip())
                    chunk = self.process_entry(entry, index)
                    if chunk:
                        self.chunks.append(chunk)
                except json.JSONDecodeError as e:
                    print(f"❌ JSON decode error at line {index}: {e}")
                    continue

        print(f"✅ Processed {len(self.chunks)} chunks")

    def save_chunks(self):
        """Save chunks to JSON file"""
        output_path = self.output_dir / "chunks.json"

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(self.chunks, f, indent=2, ensure_ascii=False)

        print(f"💾 Saved chunks to: {output_path}")

    def save_stats(self):
        """Save statistics to JSON file"""
        stats_path = self.output_dir / "chunks_stats.json"

        # Add category breakdown
        category_counts = {k: v for k, v in self.stats.items() if k.startswith("category_")}
        role_counts = {k: v for k, v in self.stats.items() if k.startswith("role_")}
        company_counts = {k: v for k, v in self.stats.items() if k.startswith("company_")}

        stats_summary = {
            "total_chunks": self.stats["total_chunks"],
            "categories": category_counts,
            "roles": role_counts,
            "companies": company_counts
        }

        with open(stats_path, 'w', encoding='utf-8') as f:
            json.dump(stats_summary, f, indent=2, ensure_ascii=False)

        print(f"📊 Saved statistics to: {stats_path}")
        print("\n📈 Summary:")
        print(f"   Total chunks: {self.stats['total_chunks']}")
        print(f"   Categories: {len(category_counts)}")
        print(f"   Companies: {len(company_counts)}")

    def run(self):
        """Execute the full pipeline"""
        print("🚀 Starting Knowledge Base Creation...")
        self.process_all_entries()
        self.save_chunks()
        self.save_stats()
        print("✅ Knowledge base creation complete!")


def main():
    """Main entry point"""
    # Paths relative to script location
    script_dir = Path(__file__).parent
    input_path = script_dir.parent / "data" / "cv-training-data.jsonl"
    output_dir = script_dir / "knowledge_base"

    creator = KnowledgeBaseCreator(
        input_path=str(input_path),
        output_dir=str(output_dir)
    )

    creator.run()


if __name__ == "__main__":
    main()
