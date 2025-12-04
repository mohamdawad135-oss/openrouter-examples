/**
 * Example: OpenRouter FileParserPlugin - Skip Parsing Costs (AI SDK)
 *
 * This example demonstrates how to reuse file annotations from previous
 * responses to skip PDF re-parsing and reduce costs in multi-turn conversations.
 *
 * Key Points:
 * - First request: PDF is parsed, annotations are returned in providerMetadata
 * - Subsequent requests: Pass annotations via providerOptions to skip re-parsing
 * - Cost savings: ~53% reduction in mistral-ocr costs for follow-up messages
 *
 * How it works:
 * 1. Send a PDF in your first message
 * 2. Extract annotations from `result.providerMetadata.openrouter.annotations`
 * 3. In follow-up messages, include annotations via `providerOptions.openrouter.annotations`
 * 4. OpenRouter uses cached parse results instead of re-parsing
 *
 * To run: bun run typescript/ai-sdk-v5/src/plugin-file-parser/skip-parsing-costs.ts
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText, type CoreMessage } from 'ai';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

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

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║     OpenRouter FileParserPlugin - Skip Parsing Costs (AI SDK)              ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log();
  console.log('This example demonstrates how to reuse annotations to skip PDF re-parsing.');
  console.log('PDF:', PDF_URL);
  console.log();

  const model = openrouter('openai/gpt-4o-mini', {
    plugins: [{ id: 'file-parser', pdf: { engine: 'mistral-ocr' } }],
    usage: { include: true },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: First request - PDF is parsed, annotations returned
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('─'.repeat(70));
  console.log('STEP 1: Initial request (PDF will be parsed)');
  console.log('─'.repeat(70));

  const firstResult = await generateText({
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is the title of this document?' },
          { type: 'file', data: PDF_URL, mediaType: 'application/pdf' },
        ],
      },
    ],
  });

  // Extract annotations from providerMetadata
  const orMetadata = firstResult.providerMetadata?.openrouter as
    | { annotations?: FileAnnotation[]; usage?: { cost?: number } }
    | undefined;
  const annotations = orMetadata?.annotations;
  const firstCost = orMetadata?.usage?.cost ?? 0;

  console.log('Response:', firstResult.text);
  console.log('Cost: $' + firstCost.toFixed(6));
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

  const followUpWithAnnotations: CoreMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What is the title of this document?' },
        { type: 'file', data: PDF_URL, mediaType: 'application/pdf' },
      ],
    },
    {
      role: 'assistant',
      content: [{ type: 'text', text: firstResult.text }],
      // KEY: Pass annotations via providerOptions to skip re-parsing
      providerOptions: {
        openrouter: {
          annotations,
        },
      },
    },
    {
      role: 'user',
      content: 'Who is the author?',
    },
  ];

  const withAnnotationsResult = await generateText({
    model,
    messages: followUpWithAnnotations,
  });

  const withAnnotationsMetadata = withAnnotationsResult.providerMetadata?.openrouter as
    | { usage?: { cost?: number } }
    | undefined;
  const costWithAnnotations = withAnnotationsMetadata?.usage?.cost ?? 0;

  console.log('Response:', withAnnotationsResult.text);
  console.log('Cost: $' + costWithAnnotations.toFixed(6));
  console.log();

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Follow-up WITHOUT annotations - parsing happens AGAIN
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('─'.repeat(70));
  console.log('STEP 3: Follow-up WITHOUT annotations (PDF re-parsed)');
  console.log('─'.repeat(70));

  const followUpWithoutAnnotations: CoreMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What is the title of this document?' },
        { type: 'file', data: PDF_URL, mediaType: 'application/pdf' },
      ],
    },
    {
      role: 'assistant',
      content: [{ type: 'text', text: firstResult.text }],
      // NO providerOptions - PDF will be re-parsed
    },
    {
      role: 'user',
      content: 'Who is the author?',
    },
  ];

  const withoutAnnotationsResult = await generateText({
    model,
    messages: followUpWithoutAnnotations,
  });

  const withoutAnnotationsMetadata = withoutAnnotationsResult.providerMetadata?.openrouter as
    | { usage?: { cost?: number } }
    | undefined;
  const costWithoutAnnotations = withoutAnnotationsMetadata?.usage?.cost ?? 0;

  console.log('Response:', withoutAnnotationsResult.text);
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
  console.log('via providerOptions.openrouter.annotations to skip re-parsing.');
}

main().catch((error) => {
  console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
