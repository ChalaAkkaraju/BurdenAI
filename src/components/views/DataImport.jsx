import { useState, useRef, useMemo } from 'react';
import {
  Upload,
  Server,
  HardDrive,
  Download,
  CheckCircle,
  AlertCircle,
  Clock,
  XCircle,
  RefreshCw,
  Eye,
  Edit2,
  FileText,
  BookOpen,
  Database,
  Plus,
  Minus,
  Edit3,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  downloadTemplate,
  parseCsv,
  diffPolicies,
  fetchFromErp,
  SUPPORTED_ERPS,
} from '../../services/erpAllocationService';
import { asOfDate, isoDay } from '../../data/asOf.js';

const compactDay = (offset) => isoDay(asOfDate(offset)).replace(/-/g, '');

export default function DataImport() {
  const { addAuditEntry, allocationRules, setAllocationRules } = useApp();
  const fileInputRef = useRef(null);

  /* ── Allocation policies data source ── */
  const [erpSystem, setErpSystem] = useState('oracle');
  const [syncing, setSyncing] = useState(false);
  const [pendingRows, setPendingRows] = useState(null);
  const [pendingSource, setPendingSource] = useState(null);
  const [importErrors, setImportErrors] = useState([]);
  const [lastSyncMessage, setLastSyncMessage] = useState(null);

  const pendingDiff = useMemo(
    () => pendingRows ? diffPolicies(allocationRules || [], pendingRows) : null,
    [pendingRows, allocationRules]
  );

  const handlePolicyFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { rows, errors } = parseCsv(ev.target.result);
      setImportErrors(errors);
      if (errors.length === 0 && rows.length > 0) {
        setPendingRows(rows);
        setPendingSource('csv');
        setLastSyncMessage(null);
      } else {
        setPendingRows(null);
        setPendingSource(null);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleErpSync = async () => {
    setSyncing(true);
    setImportErrors([]);
    setLastSyncMessage(null);
    try {
      const rows = await fetchFromErp(erpSystem);
      setPendingRows(rows);
      setPendingSource('erp');
    } catch (err) {
      setImportErrors([`ERP sync failed: ${err.message || err}`]);
    } finally {
      setSyncing(false);
    }
  };

  const applyPending = () => {
    if (!pendingRows) return;
    setAllocationRules(pendingRows);
    const src = pendingSource === 'erp'
      ? `Synced ${pendingRows.length} policies from ${SUPPORTED_ERPS.find(e => e.id === erpSystem)?.label}`
      : `Imported ${pendingRows.length} policies from CSV template`;
    setLastSyncMessage(`${src} at ${new Date().toLocaleTimeString()}`);
    setPendingRows(null);
    setPendingSource(null);
  };

  const cancelPending = () => {
    setPendingRows(null);
    setPendingSource(null);
    setImportErrors([]);
  };

  // File upload state
  const [uploadState, setUploadState] = useState('idle'); // idle, uploading, validating, complete
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFileName, setSelectedFileName] = useState(null);

  // API Integration state
  const [apiTestState, setApiTestState] = useState('idle'); // idle, testing, success, failed
  const [apiTestMessage, setApiTestMessage] = useState('');
  const [apiSyncState, setApiSyncState] = useState('idle'); // idle, syncing, success, failed
  const [apiSyncMessage, setApiSyncMessage] = useState('');
  const [apiSyncProgress, setApiSyncProgress] = useState(0);

  // SFTP state
  const [sftpTestState, setSftpTestState] = useState('idle');
  const [sftpTestMessage, setSftpTestMessage] = useState('');

  // Import history mock data
  const [importHistory] = useState([
    {
      id: 1,
      date: isoDay(asOfDate(3)),
      source: 'File Upload',
      file: `employees_master_${compactDay(3)}.csv`,
      records: 2543,
      status: 'Completed',
    },
    {
      id: 2,
      date: isoDay(asOfDate(2)),
      source: 'API Integration',
      file: 'api.company.com/employees',
      records: 1256,
      status: 'Completed',
    },
    {
      id: 3,
      date: isoDay(asOfDate(1)),
      source: 'File Upload',
      file: `payroll_data_${compactDay(1)}.csv`,
      records: 2543,
      status: 'Completed',
    },
    {
      id: 4,
      date: isoDay(asOfDate(0)),
      source: 'SFTP',
      file: `/data/imports/benefits_${compactDay(0)}.csv`,
      records: 892,
      status: 'Completed',
    },
    {
      id: 5,
      date: isoDay(asOfDate(-1)),
      source: 'File Upload',
      file: `overhead_allocation_${compactDay(-1)}.xlsx`,
      records: 156,
      status: 'Processing',
    },
    {
      id: 6,
      date: isoDay(asOfDate(-2)),
      source: 'API Integration',
      file: 'api.company.com/costs',
      records: 3012,
      status: 'Failed',
    },
    {
      id: 7,
      date: isoDay(asOfDate(-3)),
      source: 'File Upload',
      file: `departments_${compactDay(-3)}.csv`,
      records: 45,
      status: 'Queued',
    },
    {
      id: 8,
      date: isoDay(asOfDate(-4)),
      source: 'SFTP',
      file: `/data/imports/payroll_${compactDay(-4)}.csv`,
      records: 2487,
      status: 'Completed',
    },
    {
      id: 9,
      date: isoDay(asOfDate(-5)),
      source: 'File Upload',
      file: `cost_centers_${compactDay(-5)}.csv`,
      records: 78,
      status: 'Completed',
    },
  ]);

  // Templates with CSV content
  const templates = [
    {
      name: 'Employee Master Template',
      file: 'employee-master-template.csv',
      size: '48 KB',
      content: [
        'EmployeeID,FirstName,LastName,Email,JobCode,JobTitle,JobFamily,Department,CostCenter,CountryCode,HireDate,EmploymentStatus,TerminationDate,TerminationReason,LeaveStatus,LeaveType,LeaveStart,LeaveEnd,EffectiveFrom,ManagerID',
        'EMP-001,John,Smith,john.smith@company.com,JC-101,Software Engineer,Engineering,Technology,CC-1001,US,2024-01-15,Active,,,,,,,2024-01-15,EMP-050',
        'EMP-002,Jane,Doe,jane.doe@company.com,JC-201,Product Manager,Product,Product,CC-2001,US,2023-06-01,Active,,,Paid Leave,Parental Leave,2026-02-01,2026-06-01,2023-06-01,EMP-051',
        'EMP-003,Alex,Kim,alex.kim@company.com,JC-305,Data Analyst,Analytics,Data,CC-3002,IN,2022-03-10,Terminated,2026-02-28,Voluntary Resignation,,,,,2022-03-10,EMP-052',
      ],
    },
    {
      name: 'Payroll Import Template',
      file: 'payroll-import-template.csv',
      size: '52 KB',
      content: [
        'EmployeeID,Period,BasePay,Overtime,Bonus,Allowances,Deductions,ProductiveHours,Currency',
        'EMP-001,2026-03,8500.00,0.00,0.00,500.00,0.00,168,USD',
        'EMP-002,2026-03,10000.00,0.00,1500.00,0.00,0.00,160,USD',
      ],
    },
    {
      name: 'Benefits Import Template',
      file: 'benefits-import-template.csv',
      size: '38 KB',
      content: [
        'EmployeeID,Period,BenefitType,BenefitCategory,EmployerContribution,EmployeeContribution,Currency',
        'EMP-001,2026-03,Medical Insurance,Health,650.00,150.00,USD',
        'EMP-001,2026-03,401k Match,Retirement,425.00,850.00,USD',
      ],
    },
    {
      name: 'Overhead Allocation Template',
      file: 'overhead-allocation-template.csv',
      size: '41 KB',
      content: [
        'CostCenter,Period,OverheadCategory,AllocationMethod,AllocatedAmount,Description,Currency',
        'CC-1001,2026-03,IT Support,headcount,12500.00,IT infrastructure costs,USD',
        'CC-1001,2026-03,Facilities,cost-center-proportional,8200.00,Office and facility costs,USD',
      ],
    },
  ];

  // Download template as CSV
  const handleDownloadTemplate = (template) => {
    const csvContent = template.content.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = template.file;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Validation rules
  const validationRules = [
    { id: 1, rule: 'Required fields: Employee ID, Job Code, Cost Center' },
    { id: 2, rule: 'Salary range check: $20K - $500K' },
    { id: 3, rule: 'Date format: YYYY-MM-DD' },
    { id: 4, rule: 'Duplicate ID detection: Enabled' },
  ];

  // Handle file selection
  const handleFileSelect = (file) => {
    if (file && (file.type === 'text/csv' || file.name.endsWith('.xlsx'))) {
      setSelectedFileName(file.name);
      simulateUpload(file);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // Simulate file upload with progress
  const simulateUpload = (file) => {
    setUploadState('uploading');
    setUploadProgress(0);

    // Simulate upload progress
    const uploadInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(uploadInterval);
          return 90;
        }
        return prev + Math.random() * 30;
      });
    }, 300);

    // Simulate validation phase after upload
    setTimeout(() => {
      clearInterval(uploadInterval);
      setUploadProgress(100);
      setUploadState('validating');

      // Simulate validation
      setTimeout(() => {
        setUploadState('complete');
        addAuditEntry({
          action: 'Data Import',
          entity: 'File Upload',
          details: `Successfully imported ${file.name} with 2,543 records`,
          severity: 'info',
        });

        // Reset after 3 seconds
        setTimeout(() => {
          setUploadState('idle');
          setUploadProgress(0);
          setSelectedFileName(null);
        }, 3000);
      }, 1500);
    }, 2000);
  };

  // Simulate API Test Connection
  const handleTestConnection = () => {
    setApiTestState('testing');
    setApiTestMessage('Connecting to api.company.com...');
    setTimeout(() => {
      setApiTestMessage('Authenticating...');
      setTimeout(() => {
        setApiTestMessage('Verifying endpoint access...');
        setTimeout(() => {
          const success = Math.random() > 0.2; // 80% success rate
          if (success) {
            setApiTestState('success');
            setApiTestMessage('Connection successful — API v2.4, latency 42ms');
          } else {
            setApiTestState('failed');
            setApiTestMessage('Connection failed — timeout after 30s. Check credentials.');
          }
          setTimeout(() => {
            setApiTestState('idle');
            setApiTestMessage('');
          }, 4000);
        }, 800);
      }, 600);
    }, 700);
  };

  // Simulate API Sync
  const handleApiSync = () => {
    setApiSyncState('syncing');
    setApiSyncProgress(0);
    setApiSyncMessage('Fetching records...');

    const syncInterval = setInterval(() => {
      setApiSyncProgress((prev) => {
        if (prev >= 90) {
          clearInterval(syncInterval);
          return 90;
        }
        return prev + Math.random() * 20;
      });
    }, 400);

    setTimeout(() => {
      setApiSyncMessage('Processing 1,256 records...');
      setTimeout(() => {
        clearInterval(syncInterval);
        setApiSyncProgress(100);
        setApiSyncState('success');
        setApiSyncMessage('Synced 1,256 records successfully');
        addAuditEntry({
          action: 'Data Import',
          entity: 'API Integration',
          details: 'Synced 1,256 records from api.company.com/v1/employees',
          severity: 'info',
        });
        setTimeout(() => {
          setApiSyncState('idle');
          setApiSyncProgress(0);
          setApiSyncMessage('');
        }, 3000);
      }, 1500);
    }, 2000);
  };

  // Simulate SFTP Test
  const handleSftpTest = () => {
    setSftpTestState('testing');
    setSftpTestMessage('Connecting to sftp.company.com...');
    setTimeout(() => {
      setSftpTestMessage('Verifying path /data/imports...');
      setTimeout(() => {
        setSftpTestState('success');
        setSftpTestMessage('SFTP connected — 3 files pending in /data/imports');
        setTimeout(() => {
          setSftpTestState('idle');
          setSftpTestMessage('');
        }, 4000);
      }, 800);
    }, 1000);
  };

  // Get status badge styling
  const getStatusBadge = (status) => {
    const baseClass = 'px-3 py-1 rounded-full text-sm font-medium inline-flex items-center gap-2';
    switch (status) {
      case 'Completed':
        return `${baseClass} bg-green-100 text-green-800`;
      case 'Processing':
        return `${baseClass} bg-blue-100 text-blue-800`;
      case 'Failed':
        return `${baseClass} bg-red-100 text-red-800`;
      case 'Queued':
        return `${baseClass} bg-yellow-100 text-yellow-800`;
      default:
        return baseClass;
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'Completed':
        return <CheckCircle size={16} />;
      case 'Processing':
        return <RefreshCw size={16} className="animate-spin" />;
      case 'Failed':
        return <XCircle size={16} />;
      case 'Queued':
        return <Clock size={16} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold text-gray-900">Data Import</h1>
          <p className="text-gray-600 mt-2">Import employee master data and cost files</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Import Methods Section */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-6">Import Methods</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* File Upload Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Upload className="text-blue-600" size={24} />
                <h3 className="text-lg font-semibold text-gray-900">File Upload</h3>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors mb-4"
              >
                <Upload className="mx-auto text-gray-400 mb-3" size={32} />
                <p className="text-gray-700 font-medium">Drag and drop your file here</p>
                <p className="text-gray-500 text-sm">or click to browse</p>
                <p className="text-gray-500 text-xs mt-2">Supported: .csv, .xlsx</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
              />

              {/* Upload Progress */}
              {uploadState !== 'idle' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="font-medium">{selectedFileName}</span>
                    {uploadState === 'complete' && <CheckCircle size={16} className="text-green-600" />}
                    {uploadState === 'validating' && <RefreshCw size={16} className="text-blue-600 animate-spin" />}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        uploadState === 'complete' ? 'bg-green-600' : 'bg-blue-600'
                      }`}
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500">
                    {uploadState === 'uploading' && `Uploading... ${Math.round(uploadProgress)}%`}
                    {uploadState === 'validating' && 'Validating records...'}
                    {uploadState === 'complete' && 'Upload complete!'}
                  </p>
                </div>
              )}
            </div>

            {/* API Integration Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Server className="text-green-600" size={24} />
                <h3 className="text-lg font-semibold text-gray-900">API Integration</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Endpoint</label>
                  <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded font-mono break-words">
                    api.company.com/v1/employees
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Sync</label>
                  <p className="text-sm text-gray-600">2026-04-04 14:32:00 UTC</p>
                </div>

                {/* Test Connection Result */}
                {apiTestState !== 'idle' && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
                    apiTestState === 'testing' ? 'bg-blue-50 text-blue-700' :
                    apiTestState === 'success' ? 'bg-green-50 text-green-700' :
                    'bg-red-50 text-red-700'
                  }`}>
                    {apiTestState === 'testing' && <RefreshCw size={14} className="animate-spin flex-shrink-0" />}
                    {apiTestState === 'success' && <CheckCircle size={14} className="flex-shrink-0" />}
                    {apiTestState === 'failed' && <XCircle size={14} className="flex-shrink-0" />}
                    <span>{apiTestMessage}</span>
                  </div>
                )}

                {/* Sync Progress */}
                {apiSyncState !== 'idle' && (
                  <div>
                    <div className={`flex items-center gap-2 px-3 py-2 rounded text-sm mb-2 ${
                      apiSyncState === 'syncing' ? 'bg-blue-50 text-blue-700' :
                      apiSyncState === 'success' ? 'bg-green-50 text-green-700' :
                      'bg-red-50 text-red-700'
                    }`}>
                      {apiSyncState === 'syncing' && <RefreshCw size={14} className="animate-spin flex-shrink-0" />}
                      {apiSyncState === 'success' && <CheckCircle size={14} className="flex-shrink-0" />}
                      <span>{apiSyncMessage}</span>
                    </div>
                    {apiSyncState === 'syncing' && (
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-blue-600 transition-all duration-300"
                          style={{ width: `${apiSyncProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleTestConnection}
                    disabled={apiTestState === 'testing' || apiSyncState === 'syncing'}
                    className={`flex-1 px-3 py-2 border rounded text-sm font-medium flex items-center justify-center gap-2 transition ${
                      apiTestState === 'testing'
                        ? 'border-blue-300 text-blue-600 bg-blue-50 cursor-wait'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {apiTestState === 'testing' && <RefreshCw size={14} className="animate-spin" />}
                    Test Connection
                  </button>
                  <button
                    onClick={handleApiSync}
                    disabled={apiSyncState === 'syncing' || apiTestState === 'testing'}
                    className={`flex-1 px-3 py-2 rounded text-sm font-medium text-white flex items-center justify-center gap-2 transition ${
                      apiSyncState === 'syncing'
                        ? 'bg-blue-400 cursor-wait'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {apiSyncState === 'syncing' && <RefreshCw size={14} className="animate-spin" />}
                    Sync Now
                  </button>
                </div>
              </div>
            </div>

            {/* SFTP Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <HardDrive className="text-purple-600" size={24} />
                <h3 className="text-lg font-semibold text-gray-900">SFTP</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Host</label>
                  <p className="text-sm text-gray-600">sftp.company.com</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Path</label>
                  <p className="text-sm text-gray-600">/data/imports</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
                  <p className="text-sm text-gray-600">Daily at 2:00 AM</p>
                </div>

                {/* SFTP Test Result */}
                {sftpTestState !== 'idle' && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
                    sftpTestState === 'testing' ? 'bg-blue-50 text-blue-700' :
                    sftpTestState === 'success' ? 'bg-green-50 text-green-700' :
                    'bg-red-50 text-red-700'
                  }`}>
                    {sftpTestState === 'testing' && <RefreshCw size={14} className="animate-spin flex-shrink-0" />}
                    {sftpTestState === 'success' && <CheckCircle size={14} className="flex-shrink-0" />}
                    <span>{sftpTestMessage}</span>
                  </div>
                )}

                <button
                  onClick={handleSftpTest}
                  disabled={sftpTestState === 'testing'}
                  className={`w-full px-3 py-2 border rounded text-sm font-medium flex items-center justify-center gap-2 transition ${
                    sftpTestState === 'testing'
                      ? 'border-purple-300 text-purple-600 bg-purple-50 cursor-wait'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {sftpTestState === 'testing' && <RefreshCw size={14} className="animate-spin" />}
                  {sftpTestState === 'testing' ? 'Testing...' : 'Test & Configure'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Import History Table */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-6">Import History</h2>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Date</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Source</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">File/Endpoint</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Records</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {importHistory.map((record) => (
                    <tr key={record.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-700">{record.date}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{record.source}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 font-mono text-xs break-all">
                        {record.file}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{record.records.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={getStatusBadge(record.status)}>
                          {getStatusIcon(record.status)}
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          <button className="text-blue-600 hover:text-blue-800 flex items-center gap-1">
                            <Eye size={16} />
                            <span>View</span>
                          </button>
                          <button className="text-gray-600 hover:text-gray-800 flex items-center gap-1">
                            <RefreshCw size={16} />
                            <span>Reprocess</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Import Templates Section */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-6">Import Templates</h2>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="grid grid-cols-2 gap-4">
              {templates.map((template, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 border border-gray-200 rounded hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <FileText className="text-gray-400" size={24} />
                    <div>
                      <p className="font-medium text-gray-900">{template.name}</p>
                      <p className="text-sm text-gray-500">{template.size}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownloadTemplate(template)}
                    className="text-blue-600 hover:text-blue-800"
                    title={`Download ${template.file}`}
                  >
                    <Download size={20} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Validation Rules Panel */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-6">Validation Rules</h2>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="space-y-3">
              {validationRules.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 border border-gray-200 rounded">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
                    <p className="text-gray-700">{item.rule}</p>
                  </div>
                  <button className="text-gray-600 hover:text-gray-800">
                    <Edit2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Overhead Allocation Policies Import */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-2">
            <BookOpen size={20} className="text-indigo-600" />
            Overhead Allocation Policies
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Import allocation policies from a CSV template or sync directly from your ERP. Both flows preview a diff against what's currently active so you can review before applying.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CSV template card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-emerald-50 rounded">
                  <Upload size={16} className="text-emerald-600" />
                </div>
                <h3 className="font-semibold text-gray-900">CSV Template Import</h3>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Download the template, fill it from your ERP export, upload to preview changes.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => downloadTemplate()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition"
                >
                  <Download size={14} /> Download Template
                </button>
                <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md cursor-pointer transition">
                  <Upload size={14} /> Upload CSV
                  <input type="file" accept=".csv" className="hidden" onChange={handlePolicyFileUpload} />
                </label>
              </div>
            </div>

            {/* ERP sync card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-indigo-50 rounded">
                  <RefreshCw size={16} className="text-indigo-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Sync from ERP</h3>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Pull the latest allocation schedule directly from your financial system.
              </p>
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={erpSystem}
                  onChange={(e) => setErpSystem(e.target.value)}
                  className="text-xs border border-gray-300 rounded-md px-2 py-2 bg-white text-gray-700"
                >
                  {SUPPORTED_ERPS.map(e => (
                    <option key={e.id} value={e.id}>{e.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleErpSync}
                  disabled={syncing}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 rounded-md transition"
                >
                  <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </button>
              </div>
            </div>
          </div>

          {importErrors.length > 0 && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={16} className="text-red-600" />
                <h4 className="font-semibold text-red-900 text-sm">Import issues</h4>
              </div>
              <ul className="list-disc list-inside text-xs text-red-700 space-y-0.5">
                {importErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {lastSyncMessage && !pendingRows && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 flex items-center gap-2">
              <CheckCircle size={16} className="text-green-600" />
              {lastSyncMessage}
            </div>
          )}

          {pendingRows && pendingDiff && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-amber-600" />
                  <h4 className="font-semibold text-amber-900 text-sm">
                    Preview changes — {pendingSource === 'erp' ? 'ERP Sync' : 'CSV Import'}
                  </h4>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={cancelPending}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white hover:bg-gray-100 rounded-md border border-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={applyPending}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-md"
                  >
                    Apply Changes
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                <div className="bg-white rounded-md px-3 py-2 border border-emerald-200">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                    <Plus size={12} /> Added
                  </div>
                  <div className="text-lg font-bold text-emerald-900">{pendingDiff.added.length}</div>
                </div>
                <div className="bg-white rounded-md px-3 py-2 border border-blue-200">
                  <div className="flex items-center gap-1.5 text-xs text-blue-700 font-semibold">
                    <Edit3 size={12} /> Updated
                  </div>
                  <div className="text-lg font-bold text-blue-900">{pendingDiff.updated.length}</div>
                </div>
                <div className="bg-white rounded-md px-3 py-2 border border-red-200">
                  <div className="flex items-center gap-1.5 text-xs text-red-700 font-semibold">
                    <Minus size={12} /> Removed
                  </div>
                  <div className="text-lg font-bold text-red-900">{pendingDiff.removed.length}</div>
                </div>
              </div>

              <div className="space-y-1 text-xs max-h-48 overflow-y-auto">
                {pendingDiff.added.map(r => (
                  <div key={`a-${r.id}`} className="flex items-center gap-2 text-emerald-800">
                    <Plus size={11} /> <span className="font-mono">{r.id}</span> <span>{r.name}</span>
                  </div>
                ))}
                {pendingDiff.updated.map(u => (
                  <div key={`u-${u.before.id}`} className="flex items-center gap-2 text-blue-800">
                    <Edit3 size={11} /> <span className="font-mono">{u.before.id}</span>
                    <span>{u.after.name}</span>
                    <span className="text-blue-500">— changed: {u.changedFields.join(', ')}</span>
                  </div>
                ))}
                {pendingDiff.removed.map(r => (
                  <div key={`r-${r.id}`} className="flex items-center gap-2 text-red-800">
                    <Minus size={11} /> <span className="font-mono">{r.id}</span> <span>{r.name}</span>
                  </div>
                ))}
                {pendingDiff.added.length + pendingDiff.updated.length + pendingDiff.removed.length === 0 && (
                  <div className="text-gray-500 italic">No differences — incoming data matches current policies.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
