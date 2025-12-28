/**
 * Export Tools Router
 * 
 * Provides endpoints for exporting data to various formats:
 * 1. TXT - Plain text export
 * 2. DOC - Microsoft Word document export
 * 3. Google Doc - Google Docs export
 */

import { Router, Request, Response } from 'express';
import { env } from '../env';

const router = Router();

/**
 * Export data to TXT format
 * Returns the formatted data with a content-disposition header for download
 */
router.post('/txt', async (req: Request, res: Response) => {
  try {
    const { exportData, exportFileName = 'export.txt' } = req.body;

    if (!exportData) {
      res.status(400).json({ error: 'Export data is required' });
      return;
    }

    let textContent: string;

    // Handle different types of export data
    if (typeof exportData === 'string') {
      textContent = exportData;
    } else if (typeof exportData === 'object') {
      if (exportData.formattedReferences) {
        // Handle bibliography export
        textContent = exportData.formattedReferences;
      } else if (exportData.review) {
        // Handle literature review export
        textContent = exportData.review;
      } else if (exportData.papers && Array.isArray(exportData.papers)) {
        // Handle papers export
        textContent = exportData.papers.map((paper: any) =>
          `Title: ${paper.title || 'Untitled'}
Authors: ${paper.authors?.join(', ') || 'Unknown'}
Year: ${paper.published || 'Unknown'}
Abstract: ${paper.summary || 'Not available'}
URL: ${paper.url || 'Not available'}
${paper.doi ? `DOI: ${paper.doi}` : ''}
---
`).join('\n');
      } else {
        // Generic JSON export
        textContent = JSON.stringify(exportData, null, 2);
      }
    } else {
      textContent = 'Invalid export data';
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFileName(exportFileName)}"`);

    // Send the text content
    res.send(textContent);
  } catch (error: any) {
    console.error('[Export Tool] TXT export error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Export data to DOC format
 * Creates a basic HTML document with the content, which Word can open
 */
router.post('/doc', async (req: Request, res: Response) => {
  try {
    const { exportData, exportFileName = 'export.doc' } = req.body;

    if (!exportData) {
      res.status(400).json({ error: 'Export data is required' });
      return;
    }

    let htmlContent: string;
    let title = 'Export Document';

    // Handle different types of export data
    if (typeof exportData === 'string') {
      htmlContent = `<p>${exportData.replace(/\n/g, '</p><p>')}</p>`;
    } else if (typeof exportData === 'object') {
      if (exportData.formattedReferences) {
        // Handle bibliography export
        title = 'Bibliography';
        htmlContent = `<h1>Bibliography</h1>
<div class="bibliography">
  ${exportData.formattedReferences.split('\n').map((ref: string) => `<p>${ref}</p>`).join('\n')}
</div>`;
      } else if (exportData.review) {
        // Handle literature review export
        title = 'Literature Review';
        htmlContent = `<h1>Literature Review</h1>
<div class="review">
  ${exportData.review.replace(/\n/g, '</p><p>')}
</div>`;
      } else if (exportData.papers && Array.isArray(exportData.papers)) {
        // Handle papers export
        title = 'Research Papers';
        htmlContent = `<h1>Research Papers</h1>
<div class="papers">
  ${exportData.papers.map((paper: any) => `
    <div class="paper">
      <h2>${paper.title || 'Untitled'}</h2>
      <p><strong>Authors:</strong> ${paper.authors?.join(', ') || 'Unknown'}</p>
      <p><strong>Year:</strong> ${paper.published || 'Unknown'}</p>
      <p><strong>Abstract:</strong> ${paper.summary || 'Not available'}</p>
      <p><strong>URL:</strong> <a href="${paper.url || '#'}">${paper.url || 'Not available'}</a></p>
      ${paper.doi ? `<p><strong>DOI:</strong> ${paper.doi}</p>` : ''}
      <hr>
    </div>
  `).join('\n')}
</div>`;
      } else {
        // Generic JSON export
        title = 'Data Export';
        htmlContent = `<h1>Data Export</h1>
<pre>${JSON.stringify(exportData, null, 2)}</pre>`;
      }
    } else {
      htmlContent = '<p>Invalid export data</p>';
    }

    // Create a simple Word document (HTML that Word can open)
    const wordDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: 'Calibri', sans-serif; margin: 1in; }
    h1 { color: #2c3e50; }
    h2 { color: #3498db; }
    pre { background-color: #f7f7f7; padding: 10px; }
    .bibliography p { margin-bottom: 10px; text-indent: -2em; padding-left: 2em; }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

    // Set headers for file download
    res.setHeader('Content-Type', 'application/msword');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFileName(exportFileName)}"`);

    // Send the Word document
    res.send(wordDoc);
  } catch (error: any) {
    console.error('[Export Tool] DOC export error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Export to Google Doc (mock implementation)
 * In a real implementation, this would use the Google Drive API
 */
router.post('/google-doc', async (req: Request, res: Response) => {
  try {
    const { exportData, exportFileName = 'My Google Doc' } = req.body;

    if (!exportData) {
      res.status(400).json({ error: 'Export data is required' });
    }

    // For demonstration purposes, we're just returning success
    // In a real implementation, this would use the Google Drive API to create a document

    res.json({
      success: true,
      message: 'Export to Google Doc is currently a placeholder.',
      fileName: exportFileName,
      mockUrl: `https://docs.google.com/document/d/${Math.random().toString(36).substring(2, 15)}/edit`
    });
  } catch (error: any) {
    console.error('[Export Tool] Google Doc export error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Utility function to sanitize filenames
 */
function sanitizeFileName(fileName: string): string {
  // Remove invalid characters and limit length
  return fileName
    .replace(/[<>:"/\\|?*]/g, '_')
    .substring(0, 255);
}

// GET handler for TXT export to support window.open
router.post('/txt', (req: Request, res: Response) => {
  try {
    const { content, fileName = 'export.txt' } = req.body;
    let textContent: string;

    if (typeof content === 'string') {
      textContent = content;
    } else if (content && typeof content === 'object') {
      if ('formattedReferences' in content) {
        textContent = content.formattedReferences;
      } else if ('review' in content) {
        textContent = content.review;
      } else if (content.papers && Array.isArray(content.papers)) {
        textContent = content.papers.map((paper: any) =>
          `Title: ${paper.title}\nAuthors: ${paper.authors?.join(', ')}\nYear: ${paper.published}\nAbstract: ${paper.summary}\nURL: ${paper.url}\n---`
        ).join('\n');
      } else {
        textContent = JSON.stringify(content, null, 2);
      }
    } else {
      textContent = 'Invalid export data';
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFileName(fileName)}"`);
    res.send(textContent);

  } catch (error: any) {
    console.error('[Export Tool POST] TXT export error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET handler for DOC export to support window.open
router.get('/doc', (req: Request, res: Response) => {
  try {
    const dataParam = req.query.data as string;
    const fileName = (req.query.fileName as string) || 'export.doc';
    const exportData = dataParam ? JSON.parse(dataParam) : undefined;

    let htmlContent: string;
    let title = 'Export Document';

    if (typeof exportData === 'string') {
      htmlContent = `<p>${exportData.replace(/\n/g, '</p><p>')}</p>`;
    } else if (exportData && typeof exportData === 'object') {
      if ('formattedReferences' in exportData) {
        title = 'Bibliography';
        htmlContent = `<h1>Bibliography</h1><div>${(exportData as any).formattedReferences.split('\n').map((r: string) => `<p>${r}</p>`).join('')}</div>`;
      } else if ('review' in exportData) {
        title = 'Literature Review';
        htmlContent = `<h1>Literature Review</h1><div>${(exportData as any).review.replace(/\n/g, '</p><p>')}</div>`;
      } else if ((exportData as any).papers && Array.isArray((exportData as any).papers)) {
        title = 'Research Papers';
        htmlContent = `<h1>Research Papers</h1>${(exportData as any).papers.map((paper: any) => `
          <h2>${paper.title}</h2><p>Authors: ${paper.authors?.join(', ')}</p><p>Year: ${paper.published}</p><p>Abstract: ${paper.summary}</p><hr>
        `).join('')}`;
      } else {
        title = 'Data Export';
        htmlContent = `<h1>Data Export</h1><pre>${JSON.stringify(exportData, null, 2)}</pre>`;
      }
    } else {
      htmlContent = '<p>Invalid export data</p>';
    }

    const wordDoc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title></head><body>${htmlContent}</body></html>`;

    res.setHeader('Content-Type', 'application/msword');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFileName(fileName)}"`);
    res.send(wordDoc);
  } catch (error: any) {
    console.error('[Export Tool GET] DOC export error:', error);
    res.status(500).send('Internal server error');
  }
});

export default router; 