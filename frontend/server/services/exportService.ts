import { Request, Response } from 'express';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { stringify } from 'flatted'; // Using flatted for robust serialization

// Helper function to generate a simple DOCX document from various data types
const generateDocxContent = (data: any): (Paragraph | any)[] => {
  if (typeof data === 'string') {
    return [new Paragraph({ children: [new TextRun(data)] })];
  }
  if (Array.isArray(data)) {
    return data.flatMap(item => generateDocxContent(item));
  }
  if (typeof data === 'object' && data !== null) {
    // More sophisticated handling for specific structures if needed
    if (data.papers && Array.isArray(data.papers)) { // From Source Finder
      const content: Paragraph[] = [];
      content.push(new Paragraph({ children: [new TextRun({ text: "Research Papers", bold: true, size: 28 })] }));
      data.papers.forEach((paper: any) => {
        content.push(new Paragraph({ children: [new TextRun({ text: paper.title || 'Untitled Paper', bold: true, size: 24 })] }));
        if (paper.authors && paper.authors.length > 0) {
          content.push(new Paragraph({ children: [new TextRun({ text: `Authors: ${paper.authors.join(', ')}`, italics: true })] }));
        }
        if (paper.published) {
          content.push(new Paragraph({ children: [new TextRun({ text: `Published: ${String(paper.published).substring(0, 10)}` })] }));
        }
        if (paper.summary) {
          content.push(new Paragraph({ text: "Summary:", style: "Heading3" }));
          content.push(new Paragraph({ children: [new TextRun(paper.summary)] }));
        }
        content.push(new Paragraph(" ")); // Spacer
      });
      return content;
    } else if (data.claims && Array.isArray(data.claims)) { // From Claim Extractor or Contradiction Checker
      const content: Paragraph[] = [];
      content.push(new Paragraph({ children: [new TextRun({ text: "Extracted Claims / Contradictions", bold: true, size: 28 })] }));
      data.claims.forEach((claim: any) => {
        const claimText = typeof claim === 'string' ? claim : claim.text;
        const prefix = claim.contradicted ? '❌ Contradicted: ' : (claim.text ? '✅ Consistent: ' : '');
        content.push(new Paragraph({ children: [new TextRun(prefix + claimText)] }));
      });
      return content;
    } else if (data.review) { // From AI Literature Review
      return [
        new Paragraph({ children: [new TextRun({ text: "AI Literature Review", bold: true, size: 28 })] }),
        new Paragraph({ children: [new TextRun(data.review)] })
      ];
    } else if (data.formattedReferences) { // From Reference & Citation Management
      return [
        new Paragraph({ children: [new TextRun({ text: "Formatted References", bold: true, size: 28 })] }),
        new Paragraph({ children: [new TextRun(data.formattedReferences)] })
      ];
    }
    // Default fallback: stringify the object
    return [new Paragraph({ children: [new TextRun(JSON.stringify(data, null, 2))] })];
  }
  return [new Paragraph({ children: [new TextRun(String(data))] })];
};

export const handleWordExport = async (req: Request, res: Response) => {
  const { exportData, exportFileName } = req.body;

  if (!exportData) {
    res.status(400).json({ error: 'exportData is required' });
    return;
  }

  const resolvedFileName = exportFileName || `workflow_export_${Date.now()}.docx`;
  console.log('Received data for Word export:', stringify(exportData).substring(0, 200) + '...');
  console.log('Export file name:', resolvedFileName);

  try {
    const docContent = generateDocxContent(exportData);

    const doc = new Document({
      sections: [{
        properties: {},
        children: Array.isArray(docContent) ? docContent : [docContent], // Ensure children is an array
      }],
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader('Content-Disposition', `attachment; filename="${resolvedFileName}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);

  } catch (error: any) {
    console.error('Error generating Word document:', error);
    res.status(500).json({ error: 'Failed to generate Word document', details: error.message });
  }
}; 