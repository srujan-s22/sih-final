# SwasthyaSetu — Graphify Knowledge Graph Documentation

## 1. Overview

Graphify turns the SwasthyaSetu codebase and architecture documents into an interactive, persistent knowledge graph with community clustering, AST entity extraction, and queryable relationship mappings.

The knowledge graph output resides in `graphify-out/` at the repository root.

---

## 2. Directory Structure

```
graphify-out/
├── graph.json            # Machine-readable node and edge graph data
├── graph.html            # Interactive 3D/2D visualizer (open in browser)
├── GRAPH_REPORT.md       # Comprehensive structural audit report
├── cost.json             # Extraction token tracker
└── .graphify_manifest.json # Incremental scan manifest
```

---

## 3. Usage & CLI Commands

### Full Graph Scan
To scan the repository and regenerate the knowledge graph:
```bash
/Users/srujan/.local/bin/graphify .
```

### Incremental Update (After Code Changes)
To scan only newly modified or created files:
```bash
/Users/srujan/.local/bin/graphify . --update
```

### Fast Code-Only Scan (AST Mode)
To run AST-only extraction without semantic LLM calls:
```bash
/Users/srujan/.local/bin/graphify . --code-only
```

### Querying the Knowledge Graph
Ask architectural or relationship questions about the codebase:
```bash
/Users/srujan/.local/bin/graphify query "How does Fastify authenticate with Firebase Admin?"
```
