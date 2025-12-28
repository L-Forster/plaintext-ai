import { useState, useEffect, useRef } from "react";
import { Paper } from "@/types/paper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface PaperDetailsProps {
  paper: Paper;
  connectedPapers: Paper[];
  onClose: () => void;
  onSelectRelatedPaper: (paper: Paper) => void;
}

export function PaperDetails({
  paper,
  connectedPapers,
  onClose,
  onSelectRelatedPaper
}: PaperDetailsProps) {
  const MAX_DISPLAYED_RELATED = 15;
  const [showAllConnected, setShowAllConnected] = useState(false);
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  // Scroll to top whenever paper changes
  useEffect(() => {
    // Use setTimeout to ensure the DOM is ready before trying to scroll
    setTimeout(() => {
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = 0;
      }
    }, 0);
  }, [paper.arxiv_id]);

  // Toggle showing all connected papers
  const toggleShowAllConnected = () => {
    setShowAllConnected(!showAllConnected);
  };

  // Get papers to display (either all or limited)
  const displayedConnectedPapers = connectedPapers;

  // Format authors with proper citation
  const formatAuthors = (authors: string[]) => {
    if (!authors || authors.length === 0) return "Unknown";
    
    if (authors.length === 1) return authors[0];
    if (authors.length === 2) return `${authors[0]} and ${authors[1]}`;
    
    return `${authors[0]} et al.`;
  };
  
  // Get arXiv URL for a paper
  const getArxivUrl = (paper: Paper) => {
    // Check if we have an arxivId in the paper data
    if (paper.arxiv_id) {
      return `https://arxiv.org/abs/${paper.arxiv_id}`;
    }
    
    // Last resort: Google Scholar search using the paper title
    return `https://scholar.google.com/scholar?q=${encodeURIComponent(paper.title)}`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Paper details header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="font-['Source_Sans_Pro'] font-semibold text-lg">Paper Details</h2>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onClose} 
          className="text-gray-500 hover:text-gray-700"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      
      {/* Paper details content - add ref for scrolling */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-4" ref={scrollAreaRef}>
          {/* Paper title */}
          <h3 className="font-['Source_Sans_Pro'] font-bold text-xl text-primary leading-tight mb-2">
            {paper.title}
          </h3>
          
          {/* Paper metadata */}
          <div className="flex flex-wrap gap-2 text-xs text-gray-600 mb-3">
            {paper.published && (
              <span className="bg-gray-100 px-2 py-1 rounded">
                {paper.published}
              </span>
            )}
            {paper.journal && (
              <span className="bg-gray-100 px-2 py-1 rounded">
                {paper.journal}
              </span>
            )}
            {paper.arxiv_id && (
              <a
                href={getArxivUrl(paper)}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-1 rounded transition-colors"
              >
                arXiv
              </a>
            )}
          </div>
          
          {/* Authors */}
          <div className="text-sm text-gray-800 font-medium mb-3">
            {paper.authors && paper.authors.length > 0
              ? formatAuthors(paper.authors)
              : 'Unknown Authors'}
          </div>
          
          {/* Additional metadata */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <h5 className="text-xs text-gray-500 mb-1">Published Date</h5>
              <p className="text-sm">
                {paper.published || paper.published || 'Not available'}
              </p>
            </div>
          </div>
          
          {/* Abstract */}
          <div className="mb-4">
            <h4 className="font-semibold text-gray-800 mb-2">Abstract</h4>
            <p className="text-sm text-gray-600 leading-relaxed">
              {paper.summary}
            </p>
          </div>
          
          {/* Keywords */}
          {paper.keywords && paper.keywords.length > 0 && (
            <div className="mb-4">
              <h4 className="font-['Source_Sans_Pro'] font-semibold text-md mb-2">Keywords</h4>
              <div className="flex flex-wrap gap-2">
                {paper.keywords.map((keyword, i) => (
                  <Badge key={i} variant="outline" className="bg-gray-100 px-2 py-1 rounded-full text-xs">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <a 
              href={paper.url}
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex"
            >
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                <span>View Paper</span>
              </Button>
            </a>
          </div>
          
          {/* Related papers */}
          <div className="mb-4">
            <h4 className="font-semibold text-gray-800 mb-3">Related Papers</h4>
            
            {connectedPapers.length > 0 ? (
              <>
                <div className="space-y-3">
                  {displayedConnectedPapers.map((relatedPaper) => (
                    <div 
                      key={relatedPaper.arxiv_id} 
                      className="p-3 rounded-md border border-gray-200 hover:border-primary cursor-pointer transition-colors"
                      onClick={() => onSelectRelatedPaper(relatedPaper)}
                    >
                      <h5 className="font-medium text-primary text-sm leading-tight mb-1">
                        {relatedPaper.title}
                      </h5>
                      <div className="text-xs text-gray-500 mb-1">
                        {formatAuthors(relatedPaper.authors)}
                        {relatedPaper.published ? ` (${relatedPaper.published})` : ''}
                      </div>
                      <div className="text-xs text-gray-500 flex gap-2">
                        <span>{relatedPaper.journal || 'arXiv'}</span>
                        <span>&bull;</span>
                        <span>Cited {relatedPaper.citations || 0} times</span>
                        {relatedPaper.similarity !== undefined && (
                          <>
                            <span>&bull;</span>
                            <span>Similarity: {(relatedPaper.similarity * 100).toFixed(0)}%</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="p-3 text-sm text-gray-500 rounded-md bg-gray-50">
                No related papers available for this document.
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
