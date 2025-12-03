/**
 * Example: OpenRouter FileParserPlugin - Skip Parsing Costs
 *
 * This example demonstrates how to reuse file annotations from previous
 * responses to skip PDF re-parsing and reduce costs in multi-turn conversations.
 *
 * Key Points:
 * - First request: PDF is parsed, annotations are returned in response
 * - Subsequent requests: Send annotations back to skip re-parsing
 * - Cost savings: ~55% reduction in mistral-ocr costs for follow-up messages
 *
 * How it works:
 * 1. Send a PDF in your first message
 * 2. Extract `annotations` from `response.choices[0].message.annotations`
 * 3. In follow-up messages, include annotations on the assistant message
 * 4. OpenRouter uses cached parse results instead of re-parsing
 *
 * To run: bun run typescript/fetch/src/plugin-file-parser/skip-parsing-costs.ts
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const PDF_URL = 'https://bitcoin.org/bitcoin.pdf';

// Type for file annotations returned by OpenRouter
interface FileAnnotation {
  type: 'file';
  file: {
    hash: string;
    name: string;
    content: Array<{ type: string; text?: string }>;
  };
}

interface Message {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; file?: { filename: string; file_data: string } }>;
  annotations?: FileAnnotation[];
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
      annotations?: FileAnnotation[];
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost?: number;
  };
}

async function sendRequest(messages: Message[]): Promise<ChatCompletionResponse> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/openrouter/examples',
      'X-Title': 'Skip Parsing Costs Example',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages,
      plugins: [
        {
          id: 'file-parser',
          pdf: { engine: 'mistral-ocr' },
        },
      ],
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
  }

  return response.json() as Promise<ChatCompletionResponse>;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║        OpenRouter FileParserPlugin - Skip Parsing Costs                    ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log();
  console.log('This example demonstrates how to reuse annotations to skip PDF re-parsing.');
  console.log('PDF:', PDF_URL);
  console.log();

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: First request - PDF is parsed, annotations returned
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('─'.repeat(70));
  console.log('STEP 1: Initial request (PDF will be parsed)');
  console.log('─'.repeat(70));

  const firstMessages: Message[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What is the title of this document?' },
        {
          type: 'file',
          file: { filename: 'bitcoin.pdf', file_data: PDF_URL },
        },
      ],
    },
  ];

  const firstResponse = await sendRequest(firstMessages);
  const annotations = firstResponse.choices[0].message.annotations;

  console.log('Response:', firstResponse.choices[0].message.content);
  console.log('Cost: $' + (firstResponse.usage.cost?.toFixed(6) ?? 'N/A'));
  console.log('Annotations received:', annotations ? 'YES' : 'NO');
  if (annotations?.length) {
    console.log('  - Hash:', annotations[0].file.hash.substring(0, 16) + '...');
    console.log('  - Content parts:', annotations[0].file.content.length);
  }
  console.log();

  if (!annotations?.length) {
    console.log('ERROR: No annotations received. Cannot demonstrate skip-parsing feature.');
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Follow-up WITH annotations - parsing is SKIPPED
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('─'.repeat(70));
  console.log('STEP 2: Follow-up WITH annotations (parsing SKIPPED)');
  console.log('─'.repeat(70));

  const followUpWithAnnotations: Message[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What is the title of this document?' },
        {
          type: 'file',
          file: { filename: 'bitcoin.pdf', file_data: PDF_URL },
        },
      ],
    },
    {
      role: 'assistant',
      content: firstResponse.choices[0].message.content,
      annotations, // <-- KEY: Include annotations from first response
    },
    {
      role: 'user',
      content: 'Who is the author?',
    },
  ];

  const withAnnotationsResponse = await sendRequest(followUpWithAnnotations);
  const costWithAnnotations = withAnnotationsResponse.usage.cost ?? 0;

  console.log('Response:', withAnnotationsResponse.choices[0].message.content);
  console.log('Cost: $' + costWithAnnotations.toFixed(6));
  console.log();

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Follow-up WITHOUT annotations - parsing happens AGAIN
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('─'.repeat(70));
  console.log('STEP 3: Follow-up WITHOUT annotations (PDF re-parsed)');
  console.log('─'.repeat(70));

  const followUpWithoutAnnotations: Message[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What is the title of this document?' },
        {
          type: 'file',
          file: { filename: 'bitcoin.pdf', file_data: PDF_URL },
        },
      ],
    },
    {
      role: 'assistant',
      content: firstResponse.choices[0].message.content,
      // NO annotations - PDF will be re-parsed
    },
    {
      role: 'user',
      content: 'Who is the author?',
    },
  ];

  const withoutAnnotationsResponse = await sendRequest(followUpWithoutAnnotations);
  const costWithoutAnnotations = withoutAnnotationsResponse.usage.cost ?? 0;

  console.log('Response:', withoutAnnotationsResponse.choices[0].message.content);
  console.log('Cost: $' + costWithoutAnnotations.toFixed(6));
  console.log();

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('═'.repeat(70));
  console.log('SUMMARY');
  console.log('═'.repeat(70));
  console.log();
  console.log('Cost comparison for follow-up messages:');
  console.log(`  WITH annotations:    $${costWithAnnotations.toFixed(6)}`);
  console.log(`  WITHOUT annotations: $${costWithoutAnnotations.toFixed(6)}`);

  const savings = costWithoutAnnotations - costWithAnnotations;
  const savingsPercent = costWithoutAnnotations > 0
    ? ((savings / costWithoutAnnotations) * 100).toFixed(1)
    : '0.0';

  console.log();
  console.log(`  SAVINGS: $${savings.toFixed(6)} (${savingsPercent}%)`);
  console.log();
  console.log('Key takeaway: Always include annotations from previous responses');
  console.log('to avoid re-parsing PDFs and reduce costs in multi-turn conversations.');
}

main().catch((error) => {
  console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
