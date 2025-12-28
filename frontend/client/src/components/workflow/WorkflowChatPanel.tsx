import React, { useState, useCallback, useRef, ReactNode, useEffect, useMemo } from 'react';
import { Node, Edge } from '@xyflow/react';
import type { ToolNodeData, ToolType, ToolConfig } from './ToolNode';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PanelRightClose, Send, MessageSquare, Bot, User, Loader2, GripVertical } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';

interface WorkflowChatPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  availableTools: ToolType[];
  onWorkflowGenerated: (nodes: Node<ToolNodeData>[], edges: Edge[], source?: string) => void;
  existingNodeCount: number;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'llm';
  text: string;
  workflow?: { nodes: Node<ToolNodeData>[], edges: Edge[] };
  error?: string;
}

const WorkflowChatPanel: React.FC<WorkflowChatPanelProps> = ({
  isOpen,
  onToggle,
  availableTools,
  onWorkflowGenerated,
  existingNodeCount
}) => {
  const [userInput, setUserInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [guestSessionCreated, setGuestSessionCreated] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(320); // Default width: 320px
  const [isResizing, setIsResizing] = useState(false);
  const chatScrollAreaRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  // Session is always available in self-hosted version
  const createGuestSession = useCallback(async () => {
    setGuestSessionCreated(true);
  }, []);

  useEffect(() => {
    createGuestSession();
  }, [createGuestSession]);

  const scrollToBottom = useCallback(() => {
    if (chatScrollAreaRef.current) {
      const scrollElement = chatScrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, []);

  const handleSuccessResponse = useCallback((result: any) => {
    setTimeout(scrollToBottom, 0);

    if (result.sessionId) {
      setSessionId(result.sessionId);
    }

    if (result.clarificationNeeded) {
      const newLlmMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'llm',
        text: result.clarificationNeeded,
      };
      setChatMessages(prev => [...prev, newLlmMessage]);
      return;
    }

    if (result.error) {
      const newLlmMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'llm',
        text: `Could not generate workflow: ${result.error}`,
        error: result.error,
      };
      setChatMessages(prev => [...prev, newLlmMessage]);
      return;
    }

    const nodes = Array.isArray(result.nodes) ? result.nodes : [];
    const edges = Array.isArray(result.edges) ? result.edges : [];

    if (nodes.length > 0) {
      onWorkflowGenerated(nodes, edges, 'llm-backend');
      const newLlmMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'llm',
        text: `I've created a workflow with ${nodes.length} tool(s) based on your request. You can modify it further by adjusting the settings in each node.`,
        workflow: { nodes, edges },
      };
      setChatMessages(prev => [...prev, newLlmMessage]);
    } else {
      const newLlmMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'llm',
        text: result.clarificationNeeded || "I couldn't determine a workflow from your description. Can you try to be more specific about what you want to accomplish?",
      };
      setChatMessages(prev => [...prev, newLlmMessage]);
    }
  }, [onWorkflowGenerated, scrollToBottom]);

  const handleSendMessage = useCallback(async () => {
    if (!userInput.trim()) return;

    // Always treat input as a workflow request, no special keyword filtering
    const newUserMessage: ChatMessage = { id: Date.now().toString(), sender: 'user', text: userInput };
    setChatMessages(prev => [...prev, newUserMessage]);
    const currentInput = userInput;
    setUserInput('');
    setIsProcessing(true);
    setTimeout(scrollToBottom, 0);

    try {
      if (!guestSessionCreated) {
        await createGuestSession();
      }

      // Directly generate workflow from the text, no preliminary filtering
      const response = await fetch('/api/generate-workflow-from-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          userInput: currentInput,
          existingNodeCount: existingNodeCount,
          sessionId: sessionId
        }),
      });

      setIsProcessing(false);

      if (response.status === 401 || response.status === 403) {
        const errorText = await response.text();
        if (errorText.includes('expired') || errorText.includes('Invalid')) {
          console.log('Session expired or invalid, creating new session and retrying...');
          await createGuestSession();
          setSessionId(null);

          const retryResponse = await fetch('/api/generate-workflow-from-text', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              userInput: currentInput,
              existingNodeCount: existingNodeCount,
            }),
          });

          if (retryResponse.ok) {
            const result = await retryResponse.json();
            handleSuccessResponse(result);
            return;
          } else {
            throw new Error(`Failed to retry after session renewal: ${retryResponse.status}`);
          }
        }
      }

      const result = await response.json();

      if (!response.ok) {
        const errorText = result.message || result.error || `Failed to generate workflow (HTTP ${response.status})`;
        const newLlmMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'llm',
          text: `Error: ${errorText}`,
          error: errorText,
        };
        setChatMessages(prev => [...prev, newLlmMessage]);
        return;
      }

      handleSuccessResponse(result);

    } catch (error: any) {
      setIsProcessing(false);
      setTimeout(scrollToBottom, 0);
      console.error('Error calling workflow generation API:', error);
      const newLlmMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'llm',
        text: `A network error occurred: ${error.message || 'Unable to reach workflow service.'}`,
        error: error.message || 'Network error',
      };
      setChatMessages(prev => [...prev, newLlmMessage]);
    }
  }, [userInput, existingNodeCount, sessionId, onWorkflowGenerated, scrollToBottom, guestSessionCreated, createGuestSession, handleSuccessResponse]);

  const handleApplyWorkflow = useCallback((nodes?: Node<ToolNodeData>[], edges?: Edge[]) => {
    if (nodes && edges) {
      onWorkflowGenerated(nodes, edges, 'llm-replay');
      const newLlmMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'llm',
        text: "Re-applied the previously suggested workflow to the canvas."
      };
      setChatMessages(prev => [...prev, newLlmMessage]);
      setTimeout(scrollToBottom, 0);
    }
  }, [onWorkflowGenerated, scrollToBottom]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 280 && newWidth <= 600) {
        setPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  if (!isOpen) {
    return null; // Don't render anything when closed, the button is already in WorkflowBuilder
  }

  return (
    <Card
      className="fixed top-16 right-0 shadow-xl border-l border-theme-border flex flex-col z-40 bg-theme-card dark:bg-slate-900 h-[calc(100vh-4rem)]"
      style={{ width: `${panelWidth}px` }}
    >
      <div
        ref={resizeHandleRef}
        className="absolute left-0 top-0 w-2 h-full cursor-ew-resize hover:bg-primary/10 active:bg-primary/20 z-50"
        onMouseDown={startResizing}
      />
      <CardHeader className="flex flex-row items-center justify-between p-3 border-b border-theme-border dark:border-slate-700">
        <CardTitle className="text-base font-semibold text-theme-foreground dark:text-slate-200">
          Workflow Assistant
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onToggle} title="Close Assistant">
          <PanelRightClose className="h-5 w-5" />
        </Button>
      </CardHeader>
      <CardContent className="flex-grow p-0 overflow-hidden">
        <ScrollArea className="h-full p-3" ref={chatScrollAreaRef}>
          <div className="space-y-4">
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] p-3 text-sm shadow-md 
                    ${msg.sender === 'user'
                      ? 'bg-primary text-primary-foreground rounded-xl'
                      : 'bg-theme-muted dark:bg-slate-800 dark:text-slate-200 rounded-xl'}`}
                >
                  <p className={`whitespace-pre-wrap ${msg.sender === 'llm' ? 'dark:text-slate-300' : ''}`}>
                    {msg.text}
                  </p>
                  {msg.sender === 'llm' && msg.error && (
                    <p className="whitespace-pre-wrap text-destructive dark:text-red-400 text-xs mt-1">Error: {msg.error}</p>
                  )}
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="max-w-[85%] p-3 rounded-xl text-sm bg-theme-muted dark:bg-slate-800 flex items-center shadow-md">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary dark:text-sky-400" />
                  <span className="text-xs italic text-slate-600 dark:text-slate-400">Assistant is thinking...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-3 border-t border-theme-border dark:border-slate-700">
        <div className="flex w-full items-center space-x-2">
          <Textarea
            placeholder="Describe your workflow (e.g., 'Find papers, review them, then export to TXT')"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            rows={2}
            className="flex-1 text-sm resize-none dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
            disabled={isProcessing}
          />
          <Button type="submit" size="icon" onClick={handleSendMessage} disabled={!userInput.trim() || isProcessing} title="Send">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default WorkflowChatPanel;