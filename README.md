# PlaintextAI

Open-source AI research assistant for exploring academic papers, generating literature reviews, and extracting insights.

---

## Quick Start

```bash
git clone https://github.com/l-forster/plaintext-ai.git
cd plaintext-ai
echo "OPENAI_API_KEY=sk-your-key-here" > frontend/.env
npm install && cd frontend && npm install && npm run dev
```

Open http://localhost:5173

That's it. One OpenAI API key required.

---

## Features

- **AI Research Agent** - Ask questions about papers in natural language
- **Paper Search** - 200M+ papers from Semantic Scholar
- **PDF Upload & Parsing** - Extract metadata, claims, and references from PDFs
- **Citation Network Visualization** - Explore paper citation graphs
- **Literature Review Generator** - Auto-generate comprehensive reviews
- **Claim Extraction** - Extract key claims from research
- **Contradiction Checker** - Find contradictions in scientific text
- **Visual Workflow Builder** - Drag-and-drop research pipelines
- **Citation Management** - APA, MLA, Chicago, Harvard formats
- **Data Analysis** - CSV upload for AI insights
- **Export** - TXT, Word, Google Docs

---

## Usage Examples

### Research Agent

```
You: "Find recent papers on transformer architectures and summarize key contributions"

AI: *searches papers* → *analyzes* → *generates summary with citations*
```

### Workflow Builder

Build custom pipelines:

```
[Source Finder] → [Claim Extractor] → [Contradiction Checker] → [Export DOC]
```

Run the workflow and get automated results.

### Data Analysis

Upload a CSV file:
```
sales_data.csv → AI analyzes trends, outliers, correlations → Generate insights
```

### PDF Upload

Upload academic PDFs:
```
paper.pdf → Extracts title, authors, abstract, claims, references → Search for related papers
```

### Citation Network

Visualize citation relationships:
```
Enter paper ID → Builds citation graph → Explore connected papers interactively
```

---

## SDK / API Usage

### Using the API Client

```typescript
import { apiRequest } from './lib/queryClient';

// Search papers
const papers = await apiRequest('POST', '/api/source-finder/search', {
  query: 'machine learning',
  model: 'nineveh'
});

// Generate literature review
const review = await apiRequest('POST', '/api/literature-review/generate', {
  reviewTopicScope: 'transformer architectures',
  reviewType: 'systematic',
  reviewDepthLength: 'comprehensive',
  reviewTone: 'academic',
  model: 'nineveh'
});

// Extract claims
const claims = await apiRequest('POST', '/api/claim-extractor/extract', {
  prompt: 'Large language models demonstrate emergent abilities...',
  model: 'nineveh'
});

// Check contradictions
const contradictions = await apiRequest('POST', '/api/contradiction-check/check', {
  text: 'Some scientific text to check...',
  modelId: 'nineveh'
});

// Format references
const formatted = await apiRequest('POST', '/api/reference-management/format', {
  referencesInput: 'Smith, J. (2023). Paper title...',
  citationStyle: 'apa',
  model: 'nineveh'
});

// Analyze CSV data
const formData = new FormData();
formData.append('file', csvFile);
const analysis = await fetch('/api/data-analysis/analyze', {
  method: 'POST',
  body: formData
});
```

### Available API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/scholar-ai-query` | POST | AI research agent query |
| `/api/source-finder/search` | POST | Search academic papers |
| `/api/literature-review/generate` | POST | Generate literature review |
| `/api/claim-extractor/extract` | POST | Extract claims from text |
| `/api/contradiction-check/check` | POST | Check for contradictions |
| `/api/reference-management/format` | POST | Format citations |
| `/api/data-analysis/analyze` | POST | Analyze CSV data |
| `/api/pdf/parse` | POST | Parse PDF and extract metadata |
| `/api/citations/:paperId/network` | GET | Build citation network graph |
| `/api/citations/:paperId/citations` | GET | Get papers citing this paper |
| `/api/citations/:paperId/references` | GET | Get papers referenced by this paper |
| `/api/export-tools/txt` | POST | Export to TXT |
| `/api/export-tools/doc` | POST | Export to Word |
| `/api/export-tools/google-doc` | POST | Export to Google Docs |
| `/semantic-scholar/search` | GET | Proxy to Semantic Scholar |

### Request/Response Examples

**Search Papers:**
```typescript
// Request
POST /api/source-finder/search
{
  "query": "neural networks",
  "model": "nineveh"
}

// Response
{
  "papers": [
    {
      "arxiv_id": "1234.5678",
      "title": "Deep Neural Networks",
      "summary": "Abstract text...",
      "authors": ["John Doe", "Jane Smith"],
      "published": "2023-01-15",
      "citations": 42,
      "url": "https://arxiv.org/abs/1234.5678"
    }
  ]
}
```

**Generate Literature Review:**
```typescript
// Request
POST /api/literature-review/generate
{
  "reviewTopicScope": "attention mechanisms in transformers",
  "reviewType": "narrative",
  "reviewDepthLength": "moderate",
  "reviewTone": "academic",
  "yearFrom": 2020,
  "yearTo": 2024,
  "model": "nineveh"
}

// Response
{
  "review": "# Literature Review: Attention Mechanisms\n\n## Introduction\n...",
  "papers": [...],
  "citations": [...]
}
```

**Extract Claims:**
```typescript
// Request
POST /api/claim-extractor/extract
{
  "prompt": "Recent studies show that large language models...",
  "model": "nineveh"
}

// Response
{
  "claims": [
    {
      "id": "claim_1",
      "text": "Large language models demonstrate emergent capabilities",
      "confidence": 0.95
    }
  ]
}
```

### Using the Workflow Builder Component

```tsx
import { WorkflowBuilder } from '@/components/workflow/WorkflowBuilder';

function MyApp() {
  return (
    <WorkflowBuilder
      onWorkflowComplete={(results) => {
        console.log('Workflow results:', results);
      }}
    />
  );
}
```

---

## Development

### Project Structure

```
plaintext-ai/
├── frontend/
│   ├── client/src/
│   │   ├── components/
│   │   │   ├── workflow/      # Workflow builder
│   │   │   └── ui/            # UI components
│   │   ├── pages/
│   │   │   ├── research.tsx   # Research agent page
│   │   │   └── workflow.tsx   # Workflow builder page
│   │   ├── lib/
│   │   │   ├── api.ts         # API client
│   │   │   └── queryClient.ts # React Query setup
│   │   └── types/             # TypeScript types
│   ├── server/
│   │   ├── routes/            # API endpoints
│   │   │   ├── aiAssistantRoutes.ts
│   │   │   ├── sourceFinder.ts
│   │   │   ├── literatureReview.ts
│   │   │   ├── claimExtractor.ts
│   │   │   ├── contradictionChecker.ts
│   │   │   ├── referenceManagement.ts
│   │   │   └── dataAnalysis.ts
│   │   └── services/          # Business logic
│   └── package.json
└── package.json
```

### Tech Stack

**Frontend:**
- React 19 + TypeScript
- Vite
- TanStack Query (data fetching)
- Radix UI + Tailwind CSS
- React Flow (workflow visualization)
- Wouter (routing)

**Backend:**
- Express.js
- OpenAI API (GPT models)
- Semantic Scholar API

### Development Commands

```bash
# Start dev server (both frontend and backend)
npm run dev


### Environment Variables

Create `frontend/.env`:

```bash
# Required
OPENAI_API_KEY=sk-your-openai-key

# Optional - for higher Semantic Scholar rate limits
SERVER_SEMANTIC_SCHOLAR_API_KEY=your-key

# Server config
NODE_ENV=development
PORT=3000
```

---

## Available AI Models

| Model ID | Name | Description |
|----------|------|-------------|
| `nineveh` | Nineveh | Fast, cost-effective model for general queries |
| `babylon` | Babylon | Advanced model with reasoning capabilities |

---

## Tools Reference

| Tool | Input | Output |
|------|-------|--------|
| **Source Finder** | Search query | List of papers |
| **AI Literature Review** | Topic, scope, type | Formatted review |
| **Reference Management** | Raw references | Formatted citations |
| **Claim Extractor** | Text | List of claims |
| **Contradiction Checker** | Text | Contradictions found |
| **Data Analysis** | CSV file | Insights & visualizations |
| **PDF Upload** | PDF file | Metadata, claims, references |
| **Citation Network** | Paper ID | Interactive graph visualization |
| **Export TXT** | Content | Text file |
| **Export DOC** | Content | Word document |
| **Export Google Doc** | Content | Google Docs link |

---

## Contributing

Pull requests welcome. Please ensure:
- Code follows existing style
- TypeScript types are properly defined
- API endpoints are documented

---

## License

MIT License - see LICENSE file


