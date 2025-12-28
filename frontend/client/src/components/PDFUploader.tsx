import React, { useState, useCallback } from 'react';
import { Upload, FileText, Loader2, Check, X, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ParsedPDFData {
    title: string;
    authors: string[];
    abstract: string;
    fullText: string;
    references: string[];
    metadata: {
        pageCount: number;
        wordCount: number;
        extractedAt: string;
    };
}

interface PDFUploaderProps {
    onParsed?: (data: ParsedPDFData) => void;
}

const PDFUploader: React.FC<PDFUploaderProps> = ({ onParsed }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [parsedData, setParsedData] = useState<ParsedPDFData | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            uploadFile(files[0]);
        }
    }, []);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            uploadFile(files[0]);
        }
    }, []);

    const uploadFile = async (file: File) => {
        if (file.type !== 'application/pdf') {
            setError('Please upload a PDF file');
            return;
        }

        setIsUploading(true);
        setError(null);
        setFileName(file.name);
        setParsedData(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/pdf/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to parse PDF');
            }

            const result = await response.json();
            setParsedData(result.data);
            onParsed?.(result.data);
        } catch (err: any) {
            setError(err.message || 'Failed to upload PDF');
            console.error('PDF upload error:', err);
        } finally {
            setIsUploading(false);
        }
    };

    const resetUploader = () => {
        setParsedData(null);
        setFileName(null);
        setError(null);
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    PDF Parser
                </CardTitle>
                <CardDescription>
                    Upload a PDF to extract text, metadata, and references
                </CardDescription>
            </CardHeader>
            <CardContent>
                {!parsedData ? (
                    <div
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging
                                ? 'border-primary bg-primary/5'
                                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                            }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        {isUploading ? (
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">
                                    Processing {fileName}...
                                </p>
                            </div>
                        ) : (
                            <>
                                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                                <p className="text-sm text-muted-foreground mb-2">
                                    Drag and drop a PDF file here, or click to browse
                                </p>
                                <input
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    id="pdf-upload"
                                />
                                <Button asChild variant="outline" size="sm">
                                    <label htmlFor="pdf-upload" className="cursor-pointer">
                                        Select PDF
                                    </label>
                                </Button>
                            </>
                        )}
                        {error && (
                            <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm flex items-center gap-2">
                                <X className="h-4 w-4" />
                                {error}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-green-600">
                                <Check className="h-5 w-5" />
                                <span className="font-medium">PDF Parsed Successfully</span>
                            </div>
                            <Button variant="outline" size="sm" onClick={resetUploader}>
                                Upload Another
                            </Button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <h4 className="text-sm font-medium text-muted-foreground">Title</h4>
                                <p className="text-base font-semibold">{parsedData.title}</p>
                            </div>

                            {parsedData.authors.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium text-muted-foreground">Authors</h4>
                                    <p className="text-sm">{parsedData.authors.join(', ')}</p>
                                </div>
                            )}

                            {parsedData.abstract && (
                                <div>
                                    <h4 className="text-sm font-medium text-muted-foreground">Abstract</h4>
                                    <p className="text-sm line-clamp-4">{parsedData.abstract}</p>
                                </div>
                            )}

                            <div className="flex gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <FileText className="h-4 w-4" />
                                    {parsedData.metadata.pageCount} pages
                                </span>
                                <span className="flex items-center gap-1">
                                    <BookOpen className="h-4 w-4" />
                                    {parsedData.references.length} references
                                </span>
                                <span>
                                    {parsedData.metadata.wordCount.toLocaleString()} words
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default PDFUploader;
