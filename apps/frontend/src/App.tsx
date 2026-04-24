import { Routes, Route, Navigate } from 'react-router';
import { useAuth } from '@/core/auth/AuthContext';
import { useTranslation } from '@/core/i18n';
import { useCoreCommands } from '@/core/commands/useCommands';
import { CommandPalette } from '@/core/commands/CommandPalette';
import { DevInspector } from '@/core/devtools/DevInspector';
import { JobProvider } from '@/core/jobs/JobContext';
import { LoginPage } from '@/routes/login/LoginPage';
import { RootLayout } from '@/routes/layout/RootLayout';
import { HomePage } from '@/routes/home/HomePage';
import { SettingsPage } from '@/routes/settings/SettingsPage';
import { FeaturesSettingsPage } from '@/routes/settings/FeaturesSettingsPage';
import { AccessibilitySettingsPage } from '@/routes/settings/AccessibilitySettingsPage';
import { SkinsSettingsPage } from '@/routes/settings/SkinsSettingsPage';
import { DeveloperPage } from '@/routes/developer/DeveloperPage';
import { ImagesPage } from '@/routes/developer/ImagesPage';
import { CommandExplorerPage } from '@/routes/developer/CommandExplorerPage';
import { SamplesHubPage } from '@/routes/developer/SamplesHubPage';
import { DeveloperSamplesPage } from '@/routes/developer/DeveloperSamplesPage';
import { DesignGuidePage } from '@/routes/developer/DesignGuidePage';
import { VscodeExplorerSample } from '@/routes/developer/samples/VscodeExplorerSample';
import { SplitViewSample } from '@/routes/developer/samples/SplitViewSample';
import { DashboardGridSample } from '@/routes/developer/samples/DashboardGridSample';
import { FullscreenCanvasSample } from '@/routes/developer/samples/FullscreenCanvasSample';
import { SpreadSandboxSample } from '@/routes/developer/samples/SpreadSandboxSample';
import { IntegrationSamplesPage } from '@/routes/developer/IntegrationSamplesPage';
import { FeedbackPage } from '@/routes/feedback/FeedbackPage';
import { TopologyHubPage } from '@/routes/topology/TopologyHubPage';
import { TopologyViewerPage } from '@/routes/topology/TopologyViewerPage';
import { WorkersPage } from '@/routes/workers/WorkersPage';
import { WorkerDetailPage } from '@/routes/workers/WorkerDetailPage';
import { ChatPage } from '@/routes/chat/ChatPage';
import { SkinEditorPage } from '@/routes/settings/SkinEditorPage';
import { KnowledgePage } from '@/routes/knowledge/KnowledgePage';
import { ArticleDetailPage } from '@/routes/knowledge/ArticleDetailPage';
import { TemplatesPage } from '@/routes/knowledge/TemplatesPage';
import { TrainingPage } from '@/routes/knowledge/TrainingPage';
import { TrainingDetailPage } from '@/routes/knowledge/TrainingDetailPage';
import { McpSettingsPage } from '@/routes/settings/McpSettingsPage';
import { TenantsSettingsPage } from '@/routes/settings/TenantsSettingsPage';
import { TenantWorkspaceLayout } from '@/routes/settings/tenant-workspace/TenantWorkspaceLayout';
import { TenantHomePage } from '@/routes/settings/tenant-workspace/TenantHomePage';
import { TenantDatabasePage } from '@/routes/settings/tenant-workspace/TenantDatabasePage';
import { TenantTableBrowserPage } from '@/routes/settings/tenant-workspace/TenantTableBrowserPage';
import { DocumentsPage } from '@/routes/knowledge/DocumentsPage';
import { ProfilePage } from '@/routes/profile/ProfilePage';
import { FeatureMatrixPage } from '@/routes/settings/FeatureMatrixPage';
import { AclMatrixPage } from '@/routes/settings/AclMatrixPage';
import { KeyVaultSettingsPage } from '@/routes/settings/KeyVaultSettingsPage';

// ─── Modules ───────────────────────────────────────────────────
import { ModulesHubPage } from '@/routes/modules/ModulesHubPage';
import { ModuleLayout } from '@/routes/modules/ModuleLayout';
import { ModuleIndexPage } from '@/routes/modules/ModuleIndexPage';
import { FeedbackTicketsPage } from '@/routes/modules/member-feedback/FeedbackTicketsPage';
import { IssuesDashboard } from '@/routes/modules/core-issues/IssuesDashboard';
import { IssuesPage } from '@/routes/modules/core-issues/IssuesPage';
import { NewIssuePage } from '@/routes/modules/core-issues/NewIssuePage';
import { LabelsPage } from '@/routes/modules/core-issues/LabelsPage';
import { ToolManagementDashboard } from '@/routes/modules/tool-management-tools/ToolManagementDashboard';

import { NewMcpServerPage } from '@/routes/modules/tool-management-tools/NewMcpServerPage';
import { UseCaseListPage } from '@/routes/modules/tool-management-tools/UseCaseListPage';
import { NewUseCasePage } from '@/routes/modules/tool-management-tools/NewUseCasePage';
import { UseCaseDetailPage } from '@/routes/modules/tool-management-tools/UseCaseDetailPage';
import { WorkflowInspectorPage } from '@/routes/modules/tool-management-tools/WorkflowInspectorPage';
import { UserWorkflowSessionsPage } from '@/routes/modules/tool-management-tools/UserWorkflowSessionsPage';
import { WorkflowFavoritesPage } from '@/routes/modules/tool-management-tools/WorkflowFavoritesPage';
import { WorkflowDirectoryPage } from '@/routes/modules/tool-management-tools/WorkflowDirectoryPage';
import { WorkflowDebugPage } from '@/routes/modules/tool-management-tools/WorkflowDebugPage';
import { WizardDebugPage } from '@/routes/modules/tool-management-tools/WizardDebugPage';
import { BuiltInWorkflowRunner } from '@/routes/modules/tool-management-tools/BuiltInWorkflowRunner';
import { IframeToolsPage } from '@/routes/modules/tool-management-tools/IframeToolsPage';
import { AdminWorkflowInspectionPage } from '@/routes/admin/AdminWorkflowInspectionPage';
import { AdminWorkflowTagsPage } from '@/routes/admin/AdminWorkflowTagsPage';

// ─── Domain: NoSQL Store ───────────────────────────────────────
import { NosqlAdminPage } from '@/routes/modules/nosql/NosqlAdminPage';
import { NosqlCollectionPage } from '@/routes/modules/nosql/NosqlCollectionPage';

// ─── Hub Pages ─────────────────────────────────────────────────
import { PlatformPage } from '@/routes/platform/PlatformPage';
import { HealthDashboardPage } from '@/routes/platform/HealthDashboardPage';
import { DatabaseExplorerPage } from '@/routes/platform/DatabaseExplorerPage';
import { AdminPage } from '@/routes/admin/AdminPage';
import { AdminOperationsPage } from '@/routes/admin/AdminOperationsPage';
import { ChatInspectionPage } from '@/routes/admin/ChatInspectionPage';
import { ProcessesPage } from '@/routes/processes/ProcessesPage';
import { ProjectsPage } from '@/routes/projects/ProjectsPage';
import { HelpPage } from '@/routes/help/HelpPage';
import { ExtensionPage } from '@/routes/extension/ExtensionPage';
import { ExtensionDownloadPage } from '@/routes/extension/ExtensionDownloadPage';
import { OfficeAddinPage } from '@/routes/office-addin/OfficeAddinPage';
import { ToolsHubPage } from '@/routes/tools/ToolsHubPage';
import { MfaOnboardingGate } from '@/core/auth/MfaOnboardingGate';



export function App() {
    const { isAuthenticated, isLoading } = useAuth();
    const { t } = useTranslation();
    const location = (typeof window !== 'undefined') ? window.location.pathname : '';

    // Public routes — accessible without authentication
    const isPublicRoute = location.startsWith('/tools');
    if (isPublicRoute) {
        return (
            <Routes>
                <Route path="tools" element={<ToolsHubPage />} />
                <Route path="tools/extension" element={<ExtensionDownloadPage />} />
            </Routes>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-pulse text-muted-foreground">{t('common.loading')}</div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <LoginPage />;
    }

    return (
        <MfaOnboardingGate>
            <AuthenticatedApp />
        </MfaOnboardingGate>
    );
}

function AuthenticatedApp() {
    // Register all core commands (navigation, theme toggle, etc.)
    useCoreCommands();

    return (
        <JobProvider>
            <CommandPalette />
            <DevInspector />
            <Routes>
                {/* Extension route — no layout chrome, designed for iframe embedding */}
                <Route path="extension" element={<ExtensionPage />} />
                <Route path="extension/workflow/:sessionId" element={<ExtensionPage />} />
                {/* Office Add-in route — task pane for Word/Excel/PowerPoint */}
                <Route path="office-addin" element={<OfficeAddinPage />} />

                <Route element={<RootLayout />}>
                    <Route index element={<HomePage />} />
                    <Route path="topology" element={<TopologyHubPage />} />
                    <Route path="topology/:id" element={<TopologyViewerPage />} />
                    <Route path="chat" element={<ChatPage />} />
                    <Route path="chat/:conversationId" element={<ChatPage />} />
                    <Route path="workers" element={<WorkersPage />} />
                    <Route path="workers/:id" element={<WorkerDetailPage />} />
                    <Route path="knowledge" element={<KnowledgePage />} />
                    <Route path="knowledge/articles/:id" element={<ArticleDetailPage />} />
                    <Route path="knowledge/templates" element={<TemplatesPage />} />
                    <Route path="knowledge/training" element={<TrainingPage />} />
                    <Route path="knowledge/training/:id" element={<TrainingDetailPage />} />
                    <Route path="knowledge/documents" element={<DocumentsPage />} />
                    <Route path="processes" element={<ProcessesPage />} />
                    <Route path="projects" element={<ProjectsPage />} />
                    <Route path="help" element={<HelpPage />} />
                    <Route path="extensions/download" element={<ExtensionDownloadPage />} />
                    <Route path="feedback" element={<FeedbackPage />} />
                    <Route path="feedback/:sessionId" element={<FeedbackPage />} />
                    <Route path="platform" element={<PlatformPage />} />
                    <Route path="platform/health" element={<HealthDashboardPage />} />
                    <Route path="platform/database" element={<DatabaseExplorerPage />} />
                    <Route path="admin" element={<AdminPage />} />
                    <Route path="admin/operations" element={<AdminOperationsPage />} />
                    <Route path="admin/chats" element={<ChatInspectionPage />} />
                    <Route path="admin/workflow" element={<AdminWorkflowInspectionPage />} />
                    <Route path="admin/workflows/tags" element={<AdminWorkflowTagsPage />} />
                    <Route path="profile" element={<ProfilePage />} />

                    {/* ─── Settings ─── */}
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="settings/features" element={<FeaturesSettingsPage />} />
                    <Route path="settings/features/matrix" element={<FeatureMatrixPage />} />
                    <Route path="settings/acl/matrix" element={<AclMatrixPage />} />
                    <Route path="settings/accessibility" element={<AccessibilitySettingsPage />} />
                    <Route path="settings/skins" element={<SkinsSettingsPage />} />
                    <Route path="settings/skins/:skinId" element={<SkinEditorPage />} />
                    <Route path="settings/keyvault" element={<KeyVaultSettingsPage />} />
                    <Route path="settings/mcp" element={<McpSettingsPage />} />
                    <Route path="settings/tenants" element={<TenantsSettingsPage />} />
                    <Route path="settings/tenants/:tenantId" element={<TenantWorkspaceLayout />}>
                        <Route index element={<TenantHomePage />} />
                        <Route path="database" element={<TenantDatabasePage />} />
                        <Route path="database/:schema/:table" element={<TenantTableBrowserPage />} />
                    </Route>
                    <Route path="developer" element={<DeveloperPage />} />
                    <Route path="developer/images" element={<ImagesPage />} />
                    <Route path="developer/commands" element={<CommandExplorerPage />} />
                    <Route path="developer/samples" element={<SamplesHubPage />} />
                    <Route path="developer/samples/layouts" element={<DeveloperSamplesPage />} />
                    <Route path="developer/samples/layouts/vscode-explorer" element={<VscodeExplorerSample />} />
                    <Route path="developer/samples/layouts/split-view" element={<SplitViewSample />} />
                    <Route path="developer/samples/layouts/dashboard-grid" element={<DashboardGridSample />} />
                    <Route path="developer/samples/layouts/fullscreen-canvas" element={<FullscreenCanvasSample />} />
                    <Route path="developer/samples/integration" element={<IntegrationSamplesPage />} />
                    <Route path="developer/samples/integration/spread-sandbox" element={<SpreadSandboxSample />} />
                    <Route path="developer/design-guide" element={<DesignGuidePage />} />

                    {/* ─── Modules Hub ─── */}
                    <Route path="modules" element={<ModulesHubPage />} />

                    {/* ─── Member Feedback Module ─── */}
                    <Route path="modules/member-feedback/tickets" element={<FeedbackTicketsPage />} />
                    <Route path="modules/member-feedback/tickets/:ticketId" element={<FeedbackTicketsPage />} />

                    {/* ─── NoSQL Store Module ─── */}
                    <Route path="modules/nosql" element={<NosqlAdminPage />} />
                    <Route path="modules/nosql/collections" element={<NosqlCollectionPage />} />
                    <Route path="modules/nosql/collections/:collectionId" element={<NosqlCollectionPage />} />
                    <Route path="modules/nosql/documents/:documentId" element={<NosqlCollectionPage />} />

                    {/* ─── Core Issues Module ─── */}
                    <Route path="modules/core-issues" element={<ModuleLayout />}>
                        <Route index element={<IssuesDashboard />} />
                        <Route path="issues" element={<IssuesPage />} />
                        <Route path="issues/:issueId" element={<IssuesPage />} />
                        <Route path="new" element={<NewIssuePage />} />
                        <Route path="labels" element={<LabelsPage />} />
                    </Route>

                    {/* ─── Tool Management Module ─── */}
                    <Route path="modules/tool-management-tools" element={<ModuleLayout />}>
                        <Route index element={<ToolManagementDashboard />} />
                        <Route path="mcp-servers/new" element={<NewMcpServerPage />} />
                        <Route path="iframe-tools" element={<IframeToolsPage />} />
                    </Route>

                    {/* ─── Workflow Module ─── */}
                    <Route path="modules/workflow" element={<ModuleLayout />}>
                        <Route index element={<WorkflowFavoritesPage />} />
                        <Route path="directory" element={<WorkflowDirectoryPage />} />
                        <Route path="builtin/:workflowId" element={<BuiltInWorkflowRunner />} />
                        <Route path="new" element={<NewUseCasePage />} />
                        <Route path=":useCaseId/edit" element={<NewUseCasePage />} />
                        <Route path="wizard-debug" element={<WizardDebugPage />} />
                        <Route path="sessions" element={<UserWorkflowSessionsPage />} />
                        <Route path="inspector/:sessionId" element={<WorkflowInspectorPage />} />
                        <Route path="debug/:sessionId" element={<WorkflowDebugPage />} />
                        <Route path=":useCaseId" element={<UseCaseDetailPage />} />
                    </Route>

                    {/* ─── Module Routes (GUID-based) ─── */}
                    <Route path="modules/:moduleId" element={<ModuleLayout />}>
                        {/* Smart index: renders correct dashboard per module */}
                        <Route index element={<ModuleIndexPage />} />
                    </Route>

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
        </JobProvider>
    );
}

function PlaceholderPage({ title, icon, description }: { title: string; icon: string; description: string }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
            <div className="text-5xl mb-4">{icon}</div>
            <h1 className="text-2xl font-bold mb-2">{title}</h1>
            <p className="text-sm max-w-md text-muted-foreground">{description}</p>
        </div>
    );
}
