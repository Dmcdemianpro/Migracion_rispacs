'use client';

import { useState } from 'react';
import Dashboard from './Dashboard';
import TablaInformes from './TablaInformes';
import ReporteDashboard from './ReporteDashboard';

type TabId = 'migracion' | 'reportes';

export default function MainContent() {
  const [activeTab, setActiveTab] = useState<TabId>('migracion');

  return (
    <div>
      <div className="tabs-header">
        <button
          onClick={() => setActiveTab('migracion')}
          className={`tab-button ${activeTab === 'migracion' ? 'active' : ''}`}
        >
          Migracion
        </button>
        <button
          onClick={() => setActiveTab('reportes')}
          className={`tab-button ${activeTab === 'reportes' ? 'active' : ''}`}
        >
          Reportes
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'migracion' && (
          <>
            <Dashboard />
            <TablaInformes />
          </>
        )}
        {activeTab === 'reportes' && <ReporteDashboard />}
      </div>
    </div>
  );
}
