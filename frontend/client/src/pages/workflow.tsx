import React from 'react';
import { MainLayout } from '@/components/ui/layout/MainLayout';
import WorkflowBuilder from '@/components/workflow/WorkflowBuilder';
import { ReactFlowProvider } from '@xyflow/react';

export default function Workflow() {
  return (
    <MainLayout hideFooter={true}>
      <div className="h-[80vh] p-4">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Workflow</h1>
        <ReactFlowProvider>
          <WorkflowBuilder />
        </ReactFlowProvider>
      </div>
    </MainLayout>
  );
} 