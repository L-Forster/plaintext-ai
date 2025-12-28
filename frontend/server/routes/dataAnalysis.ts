/**
 * Data Analysis Router
 * 
 * Provides endpoints for analyzing uploaded CSV data:
 * 1. Parses CSV files
 * 2. Performs basic statistical analysis
 * 3. Generates text insights
 */

import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { env } from '../env';
import { getModelIdForTask, selectModelForTask } from '../utils/modelSelection';
// @ts-ignore: type definitions for multer
import multer from 'multer';
import * as fs from 'fs';
import * as csv from 'fast-csv';

const router = Router();

// Configure OpenAI
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
  fileFilter: (req: Request, file: any, cb: multer.FileFilterCallback) => {
    // Accept only CSV files
    if (!file.originalname.match(/\.(csv)$/)) {
      return cb(new Error('Only CSV files are allowed'));
    }
    cb(null, true);
  }
});

interface DataColumn {
  name: string;
  type: 'numeric' | 'categorical' | 'date' | 'unknown';
  values: any[];
  summary: {
    min?: number;
    max?: number;
    mean?: number;
    median?: number;
    mode?: string | number;
    uniqueValues?: number;
    mostCommonValue?: string;
    mostCommonCount?: number;
    missingValues?: number;
  };
}

interface DataInsight {
  type: 'statistic' | 'correlation' | 'anomaly' | 'trend' | 'summary';
  description: string;
  importance: number; // 1-10 scale
  relatedColumns?: string[];
}

interface AnalysisResult {
  fileName: string;
  rowCount: number;
  columnCount: number;
  columns: DataColumn[];
  insights: DataInsight[];
  summary: string;
}

/**
 * Detect column type based on values
 */
function detectColumnType(values: any[]): 'numeric' | 'categorical' | 'date' | 'unknown' {
  // Sample up to 100 non-empty values
  const sampleValues = values
    .filter(v => v !== null && v !== undefined && v !== '')
    .slice(0, 100);

  if (sampleValues.length === 0) return 'unknown';

  // Check if numeric
  const numericCount = sampleValues.reduce((count, val) => {
    return count + ((!isNaN(Number(val)) && val !== '') ? 1 : 0);
  }, 0);

  if (numericCount / sampleValues.length > 0.8) {
    return 'numeric';
  }

  // Check if date
  const dateRegex = /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$|^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/;
  const dateCount = sampleValues.reduce((count, val) => {
    return count + (dateRegex.test(String(val)) ? 1 : 0);
  }, 0);

  if (dateCount / sampleValues.length > 0.8) {
    return 'date';
  }

  // If not numeric or date, assume categorical
  return 'categorical';
}

/**
 * Calculate basic statistics for a column
 */
function calculateColumnSummary(values: any[], type: 'numeric' | 'categorical' | 'date' | 'unknown'): DataColumn['summary'] {
  const nonEmptyValues = values.filter(v => v !== null && v !== undefined && v !== '');
  const missingValues = values.length - nonEmptyValues.length;

  // Basic summary that applies to all column types
  const summary: DataColumn['summary'] = {
    missingValues
  };

  if (nonEmptyValues.length === 0) return summary;

  // Type-specific summaries
  if (type === 'numeric') {
    const numberValues = nonEmptyValues.map(v => Number(v)).filter(v => !isNaN(v));

    if (numberValues.length > 0) {
      const sorted = [...numberValues].sort((a, b) => a - b);
      const sum = numberValues.reduce((acc, val) => acc + val, 0);
      const mean = sum / numberValues.length;

      // Calculate mode
      const valueCounts: Record<number, number> = {};
      let maxCount = 0;
      let mode: number | undefined;

      for (const val of numberValues) {
        valueCounts[val] = (valueCounts[val] || 0) + 1;
        if (valueCounts[val] > maxCount) {
          maxCount = valueCounts[val];
          mode = val;
        }
      }

      summary.min = sorted[0];
      summary.max = sorted[sorted.length - 1];
      summary.mean = mean;
      summary.median = sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];
      summary.mode = mode;
    }
  } else {
    // For categorical and other types
    const valueCounts: Record<string, number> = {};
    let maxCount = 0;
    let mostCommonValue: string | undefined;

    for (const val of nonEmptyValues) {
      const strVal = String(val);
      valueCounts[strVal] = (valueCounts[strVal] || 0) + 1;
      if (valueCounts[strVal] > maxCount) {
        maxCount = valueCounts[strVal];
        mostCommonValue = strVal;
      }
    }

    summary.uniqueValues = Object.keys(valueCounts).length;
    summary.mostCommonValue = mostCommonValue;
    summary.mostCommonCount = maxCount;
  }

  return summary;
}

/**
 * Parse CSV data from a file buffer
 */
async function parseCSV(fileBuffer: Buffer): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const rows: any[] = [];

    csv.parseString(fileBuffer.toString(), {
      headers: true,
      ignoreEmpty: true,
    })
      .on('error', (error: Error) => reject(error))
      .on('data', (row: any) => rows.push(row))
      .on('end', () => resolve(rows));
  });
}

/**
 * Generate insights from the data analysis
 */
async function generateInsights(columns: DataColumn[], rowCount: number): Promise<DataInsight[]> {
  const insights: DataInsight[] = [];

  // Basic statistical insights
  for (const column of columns) {
    if (column.type === 'numeric') {
      const { min, max, mean, median } = column.summary;

      if (min !== undefined && max !== undefined) {
        insights.push({
          type: 'statistic',
          description: `The ${column.name} ranges from ${min} to ${max}`,
          importance: 3,
          relatedColumns: [column.name]
        });
      }

      // Check for skewed distribution
      if (mean !== undefined && median !== undefined) {
        const skew = (mean - median) / ((max || 0) - (min || 0)) * 10;
        if (Math.abs(skew) > 0.3) {
          insights.push({
            type: 'statistic',
            description: `The ${column.name} distribution is ${skew > 0 ? 'positively' : 'negatively'} skewed, with mean (${mean.toFixed(2)}) ${skew > 0 ? 'greater than' : 'less than'} median (${median.toFixed(2)})`,
            importance: 6,
            relatedColumns: [column.name]
          });
        }
      }

      // Check for missing values
      if (column.summary.missingValues && column.summary.missingValues > 0) {
        const missingPercentage = (column.summary.missingValues / rowCount) * 100;
        if (missingPercentage > 5) {
          insights.push({
            type: 'anomaly',
            description: `${column.name} is missing ${column.summary.missingValues} values (${missingPercentage.toFixed(1)}%)`,
            importance: missingPercentage > 20 ? 8 : 5,
            relatedColumns: [column.name]
          });
        }
      }
    } else if (column.type === 'categorical') {
      // Insights for categorical columns
      if (column.summary.uniqueValues && column.summary.mostCommonValue && column.summary.mostCommonCount) {
        const dominancePercentage = (column.summary.mostCommonCount / rowCount) * 100;
        if (dominancePercentage > 75) {
          insights.push({
            type: 'statistic',
            description: `${column.name} is dominated by "${column.summary.mostCommonValue}" (${dominancePercentage.toFixed(1)}% of entries)`,
            importance: 7,
            relatedColumns: [column.name]
          });
        }

        if (column.summary.uniqueValues === 1) {
          insights.push({
            type: 'anomaly',
            description: `${column.name} has only one unique value: "${column.summary.mostCommonValue}"`,
            importance: 9,
            relatedColumns: [column.name]
          });
        }
      }
    }
  }

  // Look for potential correlations between numeric columns
  const numericColumns = columns.filter(c => c.type === 'numeric');
  if (numericColumns.length >= 2) {
    // For simplicity, just look at the first 5 numeric columns
    const columnsToCheck = numericColumns.slice(0, 5);

    for (let i = 0; i < columnsToCheck.length; i++) {
      for (let j = i + 1; j < columnsToCheck.length; j++) {
        const col1 = columnsToCheck[i];
        const col2 = columnsToCheck[j];

        // This is a simplistic approach - in real analysis we'd calculate proper correlation coefficients
        // For now, we'll just check if the ranges are similar relative to their means
        if (col1.summary.min !== undefined && col1.summary.max !== undefined &&
          col2.summary.min !== undefined && col2.summary.max !== undefined &&
          col1.summary.mean !== undefined && col2.summary.mean !== undefined) {

          const range1 = col1.summary.max - col1.summary.min;
          const range2 = col2.summary.max - col2.summary.min;

          // Check if the ranges are in similar proportion to their means
          const ratio1 = range1 / col1.summary.mean;
          const ratio2 = range2 / col2.summary.mean;

          if (Math.abs(ratio1 - ratio2) < 0.2) {
            insights.push({
              type: 'correlation',
              description: `${col1.name} and ${col2.name} might be correlated, as they have similar value distributions relative to their means`,
              importance: 6,
              relatedColumns: [col1.name, col2.name]
            });
          }
        }
      }
    }
  }

  return insights;
}

/**
 * Generate a textual summary of the dataset and insights using OpenAI
 */
async function generateSummary(columns: DataColumn[], insights: DataInsight[], rowCount: number): Promise<string> {
  try {
    // Create a structured analysis of the dataset for the AI model
    const datasetSummary = {
      rowCount,
      columnCount: columns.length,
      columns: columns.map(col => ({
        name: col.name,
        type: col.type,
        summary: col.summary
      })),
      insights: insights.map(insight => insight.description)
    };

    const prompt = `
    Analyze this dataset summary and provide a concise, meaningful overview in 2-3 paragraphs. 
    Focus on the most important patterns and insights. Use clear, professional language suitable for a data analysis report.
    
    DATASET SUMMARY:
    ${JSON.stringify(datasetSummary, null, 2)}
    `;

    // Auto-select model for data analysis
    const openAIModelId = getModelIdForTask('data-analysis');

    const summaryResponse = await openai.chat.completions.create({
      model: openAIModelId,
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: 500
    });

    return summaryResponse.choices[0].message.content ||
      "Unable to generate summary. Please review the dataset details and insights provided.";
  } catch (error) {
    console.error(`[Data Analysis] Error generating summary:`, error);
    return "Error generating summary. Please review the dataset details and insights manually.";
  }
}

// Simplify multer file type to any to avoid missing type definitions
interface MulterRequest extends Request {
  file: any;
}

/**
 * Main route for analyzing CSV data
 */
router.post('/analyze', upload.single('file') as any, async (req: Request, res: Response) => {
  const multerReq = req as MulterRequest;
  if (!multerReq.file) {
    res.status(400).json({ message: 'Please upload a CSV file' });
  }

  try {
    // console.log(`[Data Analysis] Processing file: ${multerReq.file.originalname}`);

    // Parse the CSV file
    const rows = await parseCSV(multerReq.file.buffer);

    if (rows.length === 0) {
      res.status(400).json({ message: 'The CSV file contains no data or is malformed' });
    }

    const columnNames = Object.keys(rows[0]);

    // Prepare columns structure
    const columns: DataColumn[] = columnNames.map(name => {
      const values = rows.map(row => row[name]);
      const type = detectColumnType(values);
      const summary = calculateColumnSummary(values, type);

      return {
        name,
        type,
        values,
        summary
      };
    });

    // Generate insights
    const insights = await generateInsights(columns, rows.length);

    // Sort insights by importance
    const sortedInsights = [...insights].sort((a, b) => b.importance - a.importance);

    // Generate summary
    const summary = await generateSummary(columns, sortedInsights, rows.length);

    // Prepare result (without the full dataset to reduce payload size)
    const result: AnalysisResult = {
      fileName: multerReq.file.originalname,
      rowCount: rows.length,
      columnCount: columns.length,
      columns: columns.map(col => ({
        name: col.name,
        type: col.type,
        summary: col.summary,
        values: [] // Don't send back all values
      })),
      insights: sortedInsights,
      summary
    };

    res.json(result);
  } catch (error: any) {
    console.error(`[Data Analysis] Error:`, error.message);
    console.error(error.stack);

    res.status(500).json({
      message: `An error occurred while analyzing the data: ${error.message}`,
      fileName: multerReq.file.originalname
    });
  }
});

/**
 * Simple health check endpoint
 */
router.get('/status', (req: Request, res: Response) => {
  res.json({ status: 'Data Analysis service is running' });
});

export default router; 