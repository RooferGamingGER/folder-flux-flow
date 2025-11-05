import React, { useMemo, useRef, useState, useEffect, useCallback, memo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useFolders } from "@/hooks/useFolders";
import { useProjects } from "@/hooks/useProjects";
import { useDeletedProjects } from "@/hooks/useDeletedProjects";
import { useMessages } from "@/hooks/useMessages";
import { useProjectFiles } from "@/hooks/useProjectFiles";
import { useProjectDirectories } from "@/hooks/useProjectDirectories";
import { useProjectDetails, ProjectDetailsData } from "@/hooks/useProjectDetails";
import { useAllProjectDetails } from "@/hooks/useAllProjectDetails";
import { useNotes } from "@/hooks/useNotes";
import { useContacts } from "@/hooks/useContacts";
import { useProjectMembers } from "@/hooks/useProjectMembers";
import { useOrganizationUsers } from "@/hooks/useOrganizationUsers";
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "@/hooks/use-toast";
import { exportProjectsToExcel, exportProjectToWord, exportProjectAsZip } from "@/lib/exportUtils";
import { PROJECT_STATUS_OPTIONS, STATUS_COLORS } from "@/lib/constants";
import { format, isSameMonth, isSameDay } from "date-fns";
import { de } from "date-fns/locale";
import { UserManagementDialog } from "@/components/UserManagementDialog";
import { ProjectMembersDialog } from "@/components/ProjectMembersDialog";
import { FolderMembersDialog } from "@/components/FolderMembersDialog";
import { UserRoleBadge } from "@/components/UserRoleBadge";
import { 
  FileText, Image as ImageIcon, Video, FileArchive, Music, Code, File as FileIcon,
  Download, ArrowUpDown, Filter, Trash2, RotateCcw, X, ChevronLeft, ChevronRight, Bell, AlertTriangle, Archive, Users, UserPlus, LogOut, Menu
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CompactDashboard } from "@/components/CompactDashboard";
import { CompactCalendar } from "@/components/CompactCalendar";
import { TrashDialog } from "@/components/TrashDialog";

const uid = (pfx = "id_") => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : pfx + Math.random().toString(36).slice(2, 10));

const tsFileSuffix = (d = new Date()) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
};

const isImgName = (name = "") => /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(name);
const isPdfName = (name = "") => /\.pdf$/i.test(name);

// File icon mapping
const getFileIcon = (fileName: string, mimeType: string = '') => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(fileName)) return ImageIcon;
  if (/\.(mp4|avi|mov|wmv|webm|mkv)$/i.test(fileName)) return Video;
  if (/\.(mp3|wav|ogg|flac|aac)$/i.test(fileName)) return Music;
  if (/\.(zip|rar|7z|tar|gz|bz2)$/i.test(fileName)) return FileArchive;
  if (/\.(js|ts|tsx|jsx|css|html|json|xml|py|java|cpp|c|h)$/i.test(fileName)) return Code;
  if (ext === 'pdf' || mimeType === 'application/pdf') return FileText;
  
  return FileIcon;
};

const fileToUrl = (file: File) =>
  new Promise<{ url: string; mime: string }>((resolve) => {
    const url = URL.createObjectURL(file);
    resolve({ url, mime: file.type || "" });
  });

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const revokeUrlSafe = (url: string) => {
  try {
    if (url && typeof url === "string" && url.startsWith("blob:")) URL.revokeObjectURL(url);
  } catch {}
};

// Standard-Ordner die nicht gelöscht/umbenannt werden können
const PROTECTED_FOLDERS = ["Bilder", "Dokumente", "Chat", "Sprachnachrichten", "Videos"];

const revokeProjectUrls = (project: Project) => {
  try {
    for (const m of project.messages || []) {
      if (m?.type === "image" && m?.content?.originalUrl) revokeUrlSafe(m.content.originalUrl);
      if (m?.type === "file" && m?.content?.url) revokeUrlSafe(m.content.url);
    }
    for (const f of project.files || []) {
      if (f?.url) revokeUrlSafe(f.url);
    }
  } catch {}
};

const revokeFolderUrls = (folder: Folder) => {
  try {
    for (const p of folder.projects || []) revokeProjectUrls(p);
  } catch {}
};

type Message = {
  id: string;
  sender: string;
  timestamp: string;
  type: "text" | "image" | "file" | "info" | "audio" | "video";
  content: any;
};

type ProjectFile = {
  id: string;
  name: string;
  size: string;
  modified: string;
  ext: string;
  url: string;
  mime: string;
  folder: string;
  takenAt: string;
  isImage: boolean;
  thumbUrl: string | null;
};

type Contact = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

type Note = {
  id: string;
  text: string;
  ts: string;
};

type ProjectDetails = {
  projektname: string;
  startdatum: string;
  enddatum: string;
  auftragsnummer: string;
  projektstatus: string;
  notiz: string;
  strasse: string;
  plz: string;
  stadt: string;
  land: string;
  ansprechpartner: string;
  notes: Note[];
  contacts: Contact[];
};

type Project = {
  id: string;
  title: string;
  created_at?: string;
  auftragsnummer?: string;
  projektstatus?: string;
  archived: boolean;
  dirs: string[];
  messages: Message[];
  files: ProjectFile[];
  details: ProjectDetails;
};

type Folder = {
  id: string;
  name: string;
  archived: boolean;
  projects: Project[];
};

export default function Index() {
  const { user, signOut } = useAuth();
  const { role, isAdmin, canManageProjects, hasFullAccess, canAccessDashboard, loading: roleLoading } = useUserRole();
  const { folders: dbFolders, isLoading: foldersLoading, createFolder: dbCreateFolder, deleteFolder: dbDeleteFolder, toggleArchive: dbToggleArchive } = useFolders();
  const { projects: dbProjects, isLoading: projectsLoading, createProject: dbCreateProject, deleteProject: dbDeleteProject, toggleArchive: dbToggleProjectArchive } = useProjects();
  const { deletedProjects, restoreProject, permanentlyDeleteProject } = useDeletedProjects();
  const { allDetails, getDetailsForProject } = useAllProjectDetails();
  
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [view, setView] = useState<"chat" | "files" | "details">("chat");
  const [showTrashDialog, setShowTrashDialog] = useState(false);
  
  // User management dialogs
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showProjectMembers, setShowProjectMembers] = useState(false);
  const [showFolderMembers, setShowFolderMembers] = useState(false);
  const [selectedFolderForMembers, setSelectedFolderForMembers] = useState<string | null>(null);
  
  // Mobile states
  const isMobile = useIsMobile();
  const [mobileLevel, setMobileLevel] = useState<'folders' | 'projects' | 'project'>('folders');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [showFolderDlg, setShowFolderDlg] = useState(false);
  const [showProjectDlg, setShowProjectDlg] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [projectFolderId, setProjectFolderId] = useState("");

  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [moveDlg, setMoveDlg] = useState<{ folderId: string; projectId: string; targetId: string } | null>(null);
  
  // Sort/Filter states
  const [sortBy, setSortBy] = useState<'title' | 'auftragsnummer' | 'projektstatus' | 'created_at'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [showExportDlg, setShowExportDlg] = useState(false);

  // Transform DB data to UI format (denormalize) + Sort/Filter
  const folders = useMemo(() => {
    if (!dbFolders || !dbProjects) return [];
    
    return dbFolders.map(folder => {
      let projectsList = dbProjects
        .filter(p => p.folder_id === folder.id)
        .map(p => {
          const details = getDetailsForProject(p.id);
          return {
            id: p.id,
            title: p.title,
            archived: p.archived,
            created_at: p.created_at,
            auftragsnummer: details?.auftragsnummer || '',
            projektstatus: details?.projektstatus || '',
            dirs: ["Bilder", "Dokumente"],
            messages: [],
            files: [],
            details: {
              projektname: details?.projektname || p.title,
              startdatum: details?.startdatum || "",
              enddatum: details?.enddatum || "",
              auftragsnummer: details?.auftragsnummer || '',
              projektstatus: details?.projektstatus || '',
              notiz: "",
              strasse: details?.strasse || '',
              plz: details?.plz || '',
              stadt: details?.stadt || '',
              land: "",
              ansprechpartner: details?.ansprechpartner || '',
              notes: [],
              contacts: [],
            },
          };
        });
      
      // Filter by status
      if (filterStatus) {
        projectsList = projectsList.filter(p => p.projektstatus === filterStatus);
      }
      
      // Sort projects
      projectsList.sort((a, b) => {
        let aVal: any = sortBy === 'created_at' ? new Date(a.created_at || 0).getTime() : (a[sortBy] || '');
        let bVal: any = sortBy === 'created_at' ? new Date(b.created_at || 0).getTime() : (b[sortBy] || '');
        
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
        
        if (sortOrder === 'asc') return aVal > bVal ? 1 : -1;
        return aVal < bVal ? 1 : -1;
      });
      
      return {
        id: folder.id,
        name: folder.name,
        archived: folder.archived,
        projects: projectsList,
      };
    });
  }, [dbFolders, dbProjects, getDetailsForProject, sortBy, sortOrder, filterStatus]);

  const isLoading = foldersLoading || projectsLoading;

  const selectedFolder = useMemo(() => folders.find((f) => f.id === selectedFolderId) || null, [folders, selectedFolderId]);
  const selectedProject = useMemo(() => {
    const f = folders.find((x) => x.id === selectedFolderId);
    return f ? f.projects.find((p) => p.id === selectedProjectId) || null : null;
  }, [folders, selectedFolderId, selectedProjectId]);

  function openFolderDialog() {
    if (!canManageProjects) {
      toast({
        title: "Keine Berechtigung",
        description: "Sie haben keine Berechtigung, Ordner zu erstellen.",
        variant: "destructive",
      });
      return;
    }
    setFolderName("");
    setShowFolderDlg(true);
    setFabOpen(false);
  }
  function openProjectDialog() {
    if (!canManageProjects) {
      toast({
        title: "Keine Berechtigung",
        description: "Sie haben keine Berechtigung, Projekte zu erstellen.",
        variant: "destructive",
      });
      return;
    }
    const pre = selectedFolderId || (folders[0]?.id ?? "");
    setProjectFolderId(pre);
    setProjectTitle("");
    setShowProjectDlg(true);
    setFabOpen(false);
  }
  function createFolder() {
    const name = folderName.trim();
    if (!name) return;
    dbCreateFolder(name);
    setShowFolderDlg(false);
  }
  function createProject() {
    const title = projectTitle.trim();
    const targetId = projectFolderId;
    if (!title || !targetId) return;
    
    dbCreateProject({ title, folderId: targetId });
    
    setSelectedFolderId(targetId);
    setView("chat");
    setShowProjectDlg(false);
  }

  const deleteFolder = (folderId: string) => {
    const f = folders.find((x) => x.id === folderId);
    if (!f) return;
    if (!confirm(`Ordner "${f.name}" inkl. Projekte löschen?`)) return;
    
    dbDeleteFolder(folderId);
    
    if (selectedFolderId === folderId) {
      setSelectedFolderId(null);
      setSelectedProjectId(null);
    }
  };
  
  const toggleArchiveFolder = (folderId: string) => {
    const folder = dbFolders.find(f => f.id === folderId);
    if (!folder) return;
    dbToggleArchive({ id: folderId, archived: folder.archived });
  };
  
  const deleteProject = (folderId: string, projectId: string) => {
    const f = folders.find((x) => x.id === folderId);
    const p = f?.projects.find((y) => y.id === projectId);
    if (!p) return;
    if (!confirm(`Projekt "${p.title}" löschen?`)) return;
    
    dbDeleteProject(projectId);
    
    if (selectedProjectId === projectId) setSelectedProjectId(null);
  };
  
  const toggleArchiveProject = (folderId: string, projectId: string) => {
    const project = dbProjects.find(p => p.id === projectId);
    if (!project) return;
    dbToggleProjectArchive({ id: projectId, archived: project.archived });
  };
  const openMoveProject = (folderId: string, projectId: string) => {
    setMoveDlg({ folderId, projectId, targetId: folders.find((f) => f.id !== folderId && !f.archived)?.id || "" });
  };
  const doMoveProject = async () => {
    if (!moveDlg?.targetId) return;
    const { projectId, targetId } = moveDlg;
    
    // Update project folder_id in database
    const project = dbProjects.find(p => p.id === projectId);
    if (!project) return;
    
    // This will be handled by a mutation - for now just close dialog
    // TODO: Implement project move mutation in useProjects hook
    setMoveDlg(null);
  };

  const allProjects = useMemo(() => {
    const list: { folderId: string; folder: Folder; project: Project }[] = [];
    for (const f of folders) {
      for (const p of f.projects) list.push({ folderId: f.id, folder: f, project: p });
    }
    return list;
  }, [folders]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return allProjects.filter(({ folder, project }) => {
      if (!showArchived && (folder.archived || project.archived)) return false;
      
      // Suche in mehreren Feldern
      const searchableText = [
        project.title,
        project.auftragsnummer,
        project.projektstatus,
        project.details.ansprechpartner,
        project.details.strasse,
        project.details.stadt,
        project.details.plz,
      ].filter(Boolean).join(' ').toLowerCase();
      
      return searchableText.includes(q);
    });
  }, [search, allProjects, showArchived]);

  return (
    <div className="h-screen w-full bg-background text-foreground">
      <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-3 shadow-sm">
        <div className="flex items-center gap-3 min-w-[180px]">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">🏗️</div>
          <div className="text-base font-semibold">Aktuelle Baustellen</div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Projekte suchen…"
            className="w-40 md:w-56 lg:w-72 bg-secondary rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-all"
          />
          {!isMobile && (
            <label className="text-sm flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-primary" /> 
              <span className="text-muted-foreground">Archiv anzeigen</span>
            </label>
          )}
          
          <button
            onClick={() => setShowTrashDialog(true)}
            className="px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors flex items-center gap-2 text-sm font-medium"
            title="Papierkorb"
          >
            <Trash2 className="w-4 h-4" />
            {!isMobile && deletedProjects.length > 0 && <span>({deletedProjects.length})</span>}
          </button>
          
          <UserRoleBadge />
          {isAdmin && (
            <button
              onClick={() => setShowUserManagement(true)}
              className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2 text-sm font-medium"
              title="Benutzerverwaltung"
            >
              <Users className="w-4 h-4" />
              {!isMobile && <span>Benutzer</span>}
            </button>
          )}
          
          <button
            onClick={async () => {
              await signOut();
              toast({ title: "Abgemeldet", description: "Sie wurden erfolgreich abgemeldet." });
            }}
            className="px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors flex items-center gap-2 text-sm font-medium"
            title="Abmelden"
          >
            <LogOut className="w-4 h-4" />
            {!isMobile && <span>Abmelden</span>}
          </button>
        </div>
      </header>

      {isMobile ? (
        <div className="h-[calc(100vh-56px)]">
          <MobileLayout
            mobileLevel={mobileLevel}
            setMobileLevel={setMobileLevel}
            folders={folders}
            selectedFolder={selectedFolder}
            selectedProject={selectedProject}
            setSelectedFolderId={setSelectedFolderId}
            setSelectedProjectId={setSelectedProjectId}
            view={view}
            setView={setView}
            showArchived={showArchived}
            isLoading={isLoading}
            search={search}
            searchResults={searchResults}
            setSearch={setSearch}
          />
        </div>
      ) : (
        <div className="h-[calc(100vh-56px)] grid grid-cols-1 md:grid-cols-[320px_1fr] xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <aside className="border-r border-border bg-sidebar relative overflow-hidden flex flex-col">
          {/* Compact Dashboard Widget */}
          {canAccessDashboard && (
            <div className="border-b border-border p-4 bg-card">
              <CompactDashboard allProjects={allProjects} />
            </div>
          )}

          {/* Compact Calendar Widget */}
          {canAccessDashboard && (
            <div className="border-b border-border p-4 bg-card">
              <CompactCalendar 
                allProjects={allProjects}
                onDateSelect={(date) => {
                  // Filter projects by selected date - future enhancement
                  console.log('Date selected:', date);
                }}
              />
            </div>
          )}

          {/* Sort/Filter Bar */}
          <div className="px-3 py-2 border-b border-border bg-card space-y-2">
            <div className="flex gap-2">
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="flex-1 text-xs px-2 py-1.5 bg-secondary border border-border rounded-md outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="created_at">Datum</option>
                <option value="title">Titel</option>
                <option value="auftragsnummer">Auftragsnummer</option>
                <option value="projektstatus">Status</option>
              </select>
              <button 
                onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
                className="px-2 py-1.5 bg-secondary border border-border rounded-md hover:bg-accent transition-colors"
                title={sortOrder === 'asc' ? 'Aufsteigend' : 'Absteigend'}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex gap-2">
              <select 
                value={filterStatus || ''}
                onChange={(e) => setFilterStatus(e.target.value || null)}
                className="flex-1 text-xs px-2 py-1.5 bg-secondary border border-border rounded-md outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Alle Status</option>
                {PROJECT_STATUS_OPTIONS.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              {filterStatus && (
                <button 
                  onClick={() => setFilterStatus(null)}
                  className="px-2 py-1.5 bg-secondary border border-border rounded-md hover:bg-accent transition-colors"
                  title="Filter zurücksetzen"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="p-4 space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : search.trim() ? (
              <SearchList results={searchResults} open={(r) => { setSelectedFolderId(r.folderId); setSelectedProjectId(r.project.id); setView("chat"); setSearch(""); }} />
            ) : folders.filter((f) => showArchived || !f.archived).length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground px-8 text-center text-sm">
                Noch keine Ordner vorhanden.<br/>Klicke auf + um zu starten.
              </div>
            ) : (
              <div className="pb-20">
                {folders.filter((f) => showArchived || !f.archived).map((f) => (
                  <FolderBlock key={f.id} f={f} selectedFolderId={selectedFolderId} selectedProjectId={selectedProjectId} setSelectedFolderId={setSelectedFolderId} setSelectedProjectId={setSelectedProjectId} showArchived={showArchived} onDelete={deleteFolder} onArchiveToggle={toggleArchiveFolder} onMoveProject={openMoveProject} onDeleteProject={deleteProject} onArchiveProject={toggleArchiveProject} />
                ))}
              </div>
            )}
          </div>

          <div className="absolute right-4 bottom-4">
            <div className="relative">
              {fabOpen && (
                <div className="absolute bottom-16 right-0 w-60 bg-card border border-border rounded-lg shadow-lg p-2 space-y-1 z-20">
                  {canManageProjects && (
                    <>
                      <button onClick={openFolderDialog} className="w-full text-left px-4 py-2.5 rounded-md hover:bg-accent text-sm font-medium transition-colors">
                        📁 Neuen Ordner erstellen
                      </button>
                      <button onClick={openProjectDialog} className="w-full text-left px-4 py-2.5 rounded-md hover:bg-accent text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={folders.length === 0}>
                        🏗️ Neues Projekt anlegen
                      </button>
                      {folders.length === 0 && (<div className="px-4 pb-1 text-xs text-muted-foreground">Erst einen Ordner anlegen</div>)}
                    </>
                  )}
                  {canManageProjects && selectedProject && (
                    <button onClick={() => { setShowProjectMembers(true); setFabOpen(false); }} className="w-full text-left px-4 py-2.5 rounded-md hover:bg-accent text-sm font-medium transition-colors border-t border-border">
                      <UserPlus className="w-4 h-4 inline mr-2" />
                      Projekt-Mitglieder
                    </button>
                  )}
                  {canManageProjects && selectedFolder && (
                    <button onClick={() => { setSelectedFolderForMembers(selectedFolderId); setShowFolderMembers(true); setFabOpen(false); }} className="w-full text-left px-4 py-2.5 rounded-md hover:bg-accent text-sm font-medium transition-colors">
                      <Users className="w-4 h-4 inline mr-2" />
                      Ordner-Mitglieder
                    </button>
                  )}
                  {!canManageProjects && (
                    <div className="px-4 py-3 text-xs text-muted-foreground text-center">
                      Sie haben keine Berechtigung,<br/>Projekte oder Ordner zu erstellen.
                    </div>
                  )}
                </div>
              )}
              <button onClick={() => setFabOpen((v) => !v)} className="w-14 h-14 rounded-full bg-primary hover:bg-primary-hover text-primary-foreground text-2xl shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95" title="Neu">
                +
              </button>
            </div>
          </div>
        </aside>

        <main className="relative overflow-hidden bg-background">
          <div className="h-14 border-b border-border px-6 flex items-center justify-between bg-card shadow-sm">
            <h2 className="font-semibold text-lg truncate">
              {selectedProject ? selectedProject.title : selectedFolder ? selectedFolder.name : "–"}
            </h2>
            <div className="flex items-center gap-2">
              {selectedProject && (
                <>
                  {canManageProjects && (
                    <button
                      onClick={() => setShowProjectMembers(true)}
                      className="px-3 py-1.5 text-xs font-medium bg-secondary hover:bg-accent border border-border rounded-md transition-colors flex items-center gap-1.5"
                      title="Projekt-Mitglieder verwalten"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">Mitglieder</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowExportDlg(true)}
                    className="px-3 py-1.5 text-xs font-medium bg-secondary hover:bg-accent border border-border rounded-md transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Export</span>
                  </button>
                  <div className="hidden sm:flex items-center gap-2 text-sm">
                    <HeaderBtn label="💬 Chat" active={view === "chat"} onClick={() => setView("chat")} />
                    <HeaderBtn label="📁 Dateien" active={view === "files"} onClick={() => setView("files")} />
                    <HeaderBtn label="📋 Details" active={view === "details"} onClick={() => setView("details")} />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="absolute inset-0 top-[56px] flex flex-col">
            {selectedProject ? (
              view === "chat" ? (
                <ChatView project={selectedProject} />
              ) : view === "files" ? (
                <FilesView project={selectedProject} />
              ) : (
                <DetailsView project={selectedProject} />
              )
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm px-8 text-center">
                {selectedFolder ? "Ordner geöffnet – wähle ein Projekt oder lege eines an" : "Wähle einen Ordner oder lege einen an"}
              </div>
            )}
          </div>
        </main>

        <aside className="hidden xl:flex flex-col w-[360px] border-l border-border bg-card">
          {selectedProject ? (
            <DetailsSidebar project={selectedProject} />
          ) : (
            <div className="h-full items-center justify-center text-muted-foreground flex text-sm">Keine Details ausgewählt</div>
          )}
        </aside>
        </div>
      )}

      {showFolderDlg && (
        <Modal title="Neuen Ordner erstellen" onClose={() => setShowFolderDlg(false)}>
          <div className="space-y-4">
            <Label>Ordnername</Label>
            <input autoFocus className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="z. B. Notfallaufträge" />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowFolderDlg(false)}>Abbrechen</Button>
              <Button onClick={createFolder} disabled={!folderName.trim()}>Erstellen</Button>
            </div>
          </div>
        </Modal>
      )}

      {showProjectDlg && (
        <Modal title="Neues Projekt anlegen" onClose={() => setShowProjectDlg(false)}>
          <div className="space-y-4">
            <Label>Projekttitel</Label>
            <input autoFocus className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} placeholder="z. B. Dachsanierung Müller" />
            <Label className="mt-3">Ordner</Label>
            <select className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" value={projectFolderId} onChange={(e) => setProjectFolderId(e.target.value)}>
              <option value="" disabled>Ordner wählen…</option>
              {folders.filter((f) => showArchived || !f.archived).map((f) => (
                <option key={f.id} value={f.id}>{f.name}{f.archived ? " (Archiv)" : ""}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowProjectDlg(false)}>Abbrechen</Button>
              <Button onClick={createProject} disabled={!projectTitle.trim() || !projectFolderId}>Anlegen</Button>
            </div>
          </div>
        </Modal>
      )}

      {moveDlg && (
        <Modal title="Projekt verschieben" onClose={() => setMoveDlg(null)}>
          <div className="space-y-4">
            <Label>Zielordner</Label>
            <select className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" value={moveDlg.targetId} onChange={(e) => setMoveDlg((m) => ({ ...m!, targetId: e.target.value }))}>
              <option value="" disabled>Ordner wählen…</option>
              {folders.filter((f) => f.id !== moveDlg.folderId).map((f) => (
                <option key={f.id} value={f.id}>{f.name}{f.archived ? " (Archiv)" : ""}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setMoveDlg(null)}>Abbrechen</Button>
              <Button onClick={doMoveProject} disabled={!moveDlg.targetId}>Verschieben</Button>
            </div>
          </div>
        </Modal>
      )}

      {showExportDlg && selectedProject && (
        <ExportDialog 
          project={selectedProject} 
          onClose={() => setShowExportDlg(false)}
          allDetails={allDetails}
        />
      )}

      <UserManagementDialog 
        open={showUserManagement}
        onClose={() => setShowUserManagement(false)}
      />

      {selectedProject && (
        <ProjectMembersDialog 
          projectId={selectedProject.id}
          open={showProjectMembers}
          onClose={() => setShowProjectMembers(false)}
        />
      )}

      {showFolderMembers && selectedFolderForMembers && (
        <FolderMembersDialog 
          folderId={selectedFolderForMembers}
          open={showFolderMembers}
          onClose={() => {
            setShowFolderMembers(false);
            setSelectedFolderForMembers(null);
          }}
        />
      )}

      <TrashDialog
        open={showTrashDialog}
        onClose={() => setShowTrashDialog(false)}
        deletedProjects={deletedProjects}
        onRestore={restoreProject}
        onPermanentDelete={permanentlyDeleteProject}
      />
    </div>
  );
}

function DeadlineNotifications({ 
  allProjects,
  setSelectedFolderId,
  setSelectedProjectId,
  setView
}: { 
  allProjects: { folderId: string; folder: Folder; project: Project }[];
  setSelectedFolderId: (id: string) => void;
  setSelectedProjectId: (id: string) => void;
  setView: (view: "chat" | "files" | "details" | "trash" | "dashboard" | "calendar") => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const notifications = useMemo(() => {
    const result: {
      type: 'warning' | 'danger';
      project: Project;
      folder: Folder;
      folderId: string;
      message: string;
      daysUntil: number;
    }[] = [];
    
    allProjects.forEach(({ project, folder, folderId }) => {
      if (project.archived || !project.details?.enddatum) return;
      
      const endDate = new Date(project.details.enddatum);
      endDate.setHours(0, 0, 0, 0);
      
      const diffTime = endDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Überfällig
      if (diffDays < 0 && project.projektstatus !== 'Abgeschlossen') {
        result.push({
          type: 'danger',
          project,
          folder,
          folderId,
          message: `Überfällig seit ${Math.abs(diffDays)} Tag${Math.abs(diffDays) > 1 ? 'en' : ''}`,
          daysUntil: diffDays,
        });
      }
      // Endet heute
      else if (diffDays === 0 && project.projektstatus !== 'Abgeschlossen') {
        result.push({
          type: 'danger',
          project,
          folder,
          folderId,
          message: 'Endet heute',
          daysUntil: 0,
        });
      }
      // Endet in den nächsten 7 Tagen
      else if (diffDays > 0 && diffDays <= 7 && project.projektstatus !== 'Abgeschlossen') {
        result.push({
          type: 'warning',
          project,
          folder,
          folderId,
          message: `Endet in ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`,
          daysUntil: diffDays,
        });
      }
    });
    
    // Sortiere: überfällig zuerst, dann nach Tagen
    return result.sort((a, b) => a.daysUntil - b.daysUntil);
  }, [allProjects]);
  
  if (notifications.length === 0) return null;
  
  return (
    <div className="bg-card border-l-4 border-yellow-500 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <Bell className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground mb-2">
            Anstehende Fristen ({notifications.length})
          </h3>
          <div className="space-y-2">
            {notifications.slice(0, 5).map(({ type, project, folder, folderId, message }) => (
              <div 
                key={project.id}
                className={`flex items-center gap-2 p-2 rounded-md ${
                  type === 'danger' 
                    ? 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800' 
                    : 'bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800'
                }`}
              >
                {type === 'danger' && <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {project.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    📁 {folder.name} • {message}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedFolderId(folderId);
                    setSelectedProjectId(project.id);
                    setView('details');
                  }}
                  className="text-xs px-2 py-1 bg-background hover:bg-accent rounded border border-border transition-colors"
                >
                  Öffnen
                </button>
              </div>
            ))}
          </div>
          {notifications.length > 5 && (
            <div className="text-xs text-muted-foreground mt-2">
              + {notifications.length - 5} weitere Fristen
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CalendarView({ 
  allProjects,
  setSelectedFolderId,
  setSelectedProjectId,
  setView
}: { 
  allProjects: { folderId: string; folder: Folder; project: Project }[];
  setSelectedFolderId: (id: string) => void;
  setSelectedProjectId: (id: string) => void;
  setView: (view: "chat" | "files" | "details" | "trash" | "dashboard" | "calendar") => void;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  
  // Projekte mit Datum extrahieren
  const projectsWithDates = useMemo(() => {
    return allProjects
      .filter(({ project }) => !project.archived && project.details?.startdatum)
      .map(({ project, folder, folderId }) => ({
        project,
        folder,
        folderId,
        startDate: new Date(project.details.startdatum!),
        endDate: project.details.enddatum ? new Date(project.details.enddatum) : null,
      }));
  }, [allProjects]);
  
  // Projekte für ausgewähltes Datum
  const projectsOnDate = useMemo(() => {
    if (!selectedDate) return [];
    return projectsWithDates.filter(({ startDate, endDate }) => {
      const isStartDate = isSameDay(startDate, selectedDate);
      const isEndDate = endDate && isSameDay(endDate, selectedDate);
      const isInRange = endDate 
        ? selectedDate >= startDate && selectedDate <= endDate
        : isSameDay(startDate, selectedDate);
      return isStartDate || isEndDate || isInRange;
    });
  }, [selectedDate, projectsWithDates]);
  
  // Custom Modifiers für den Kalender
  const modifiers = useMemo(() => {
    const hasStartDate: Date[] = [];
    const hasEndDate: Date[] = [];
    const isActive: Date[] = [];
    
    projectsWithDates.forEach(({ startDate, endDate }) => {
      hasStartDate.push(startDate);
      if (endDate) {
        hasEndDate.push(endDate);
        // Alle Tage zwischen Start und Ende markieren
        const current = new Date(startDate);
        while (current <= endDate) {
          isActive.push(new Date(current));
          current.setDate(current.getDate() + 1);
        }
      }
    });
    
    return { hasStartDate, hasEndDate, isActive };
  }, [projectsWithDates]);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <h2 className="text-2xl font-bold text-foreground">📅 Kalenderansicht</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Kalender */}
          <div className="bg-card border border-border rounded-xl p-6">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              month={currentDate}
              onMonthChange={setCurrentDate}
              locale={de}
              className="pointer-events-auto"
              modifiers={modifiers}
              modifiersClassNames={{
                hasStartDate: "bg-blue-500 text-white font-bold rounded-l-md",
                hasEndDate: "bg-green-500 text-white font-bold rounded-r-md",
                isActive: "bg-yellow-100 dark:bg-yellow-900",
              }}
            />
            
            {/* Legende */}
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded" />
                <span>Projektstart</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded" />
                <span>Projektende</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-100 dark:bg-yellow-900 border border-border rounded" />
                <span>Laufendes Projekt</span>
              </div>
            </div>
          </div>
          
          {/* Projektliste für ausgewähltes Datum */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">
              {selectedDate 
                ? `Projekte am ${format(selectedDate, 'dd.MM.yyyy', { locale: de })}`
                : "Wähle ein Datum"}
            </h3>
            
            <div className="space-y-2 max-h-96 overflow-auto">
              {projectsOnDate.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  {selectedDate ? "Keine Projekte an diesem Tag" : "Klicke auf ein Datum im Kalender"}
                </div>
              ) : (
                projectsOnDate.map(({ project, folder, folderId, startDate, endDate }) => (
                  <div 
                    key={project.id}
                    className="p-3 rounded-lg border border-border hover:bg-accent transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedFolderId(folderId);
                      setSelectedProjectId(project.id);
                      setView('chat');
                    }}
                  >
                    <div className="text-sm font-medium text-foreground truncate">
                      {project.title}
                      {project.auftragsnummer && (
                        <span className="text-xs text-muted-foreground ml-2">
                          ({project.auftragsnummer})
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      📁 {folder.name} • {project.projektstatus || "Kein Status"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(startDate, 'dd.MM.yyyy')} 
                      {endDate && ` → ${format(endDate, 'dd.MM.yyyy')}`}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        {/* Monatsübersicht aller Projekte */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">
            Projekte im {format(currentDate, 'MMMM yyyy', { locale: de })}
          </h3>
          <div className="space-y-2">
            {projectsWithDates
              .filter(({ startDate, endDate }) => 
                isSameMonth(startDate, currentDate) || 
                (endDate && isSameMonth(endDate, currentDate))
              )
              .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
              .map(({ project, folder, folderId, startDate, endDate }) => (
                <div 
                  key={project.id}
                  className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-accent transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedFolderId(folderId);
                    setSelectedProjectId(project.id);
                    setView('chat');
                  }}
                >
                  <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[project.projektstatus || ""] || "bg-muted"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {project.title}
                      {project.auftragsnummer && (
                        <span className="text-xs text-muted-foreground ml-2">
                          ({project.auftragsnummer})
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      📁 {folder.name}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {format(startDate, 'dd.MM.')}
                    {endDate && ` - ${format(endDate, 'dd.MM.')}`}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileLayout({
  mobileLevel,
  setMobileLevel,
  folders,
  selectedFolder,
  selectedProject,
  setSelectedFolderId,
  setSelectedProjectId,
  view,
  setView,
  showArchived,
  isLoading,
  search,
  searchResults,
  setSearch,
}: {
  mobileLevel: 'folders' | 'projects' | 'project';
  setMobileLevel: (level: 'folders' | 'projects' | 'project') => void;
  folders: Folder[];
  selectedFolder: Folder | null;
  selectedProject: Project | null;
  setSelectedFolderId: (id: string | null) => void;
  setSelectedProjectId: (id: string | null) => void;
  view: string;
  setView: (view: any) => void;
  showArchived: boolean;
  isLoading: boolean;
  search: string;
  searchResults: any[];
  setSearch: (search: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { canAccessDashboard } = useUserRole();
  const { deletedProjects, restoreProject, permanentlyDeleteProject } = useDeletedProjects();
  const [showTrashDialog, setShowTrashDialog] = useState(false);
  
  // Level 1: Ordner-Liste
  if (mobileLevel === 'folders') {
    return (
      <div className="h-full flex flex-col bg-background">
        {/* Header mit Hamburger Menu */}
        <div className="h-14 border-b border-border px-4 flex items-center gap-3 bg-card">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button className="p-2 hover:bg-accent rounded-lg transition-colors">
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-2">
                <button
                  onClick={() => {
                    setMobileLevel('folders');
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-accent transition-colors flex items-center gap-3"
                >
                  <span className="text-lg">🏠</span>
                  <span className="font-medium">Ordner-Übersicht</span>
                </button>
                {canAccessDashboard && (
                  <>
                    <button
                      onClick={() => {
                        // Future: Navigate to dashboard view
                        setMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 rounded-lg hover:bg-accent transition-colors flex items-center gap-3"
                    >
                      <span className="text-lg">📊</span>
                      <span className="font-medium">Dashboard</span>
                    </button>
                    <button
                      onClick={() => {
                        // Future: Navigate to calendar view
                        setMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 rounded-lg hover:bg-accent transition-colors flex items-center gap-3"
                    >
                      <span className="text-lg">📅</span>
                      <span className="font-medium">Kalender</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    setShowTrashDialog(true);
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-accent transition-colors flex items-center gap-3"
                >
                  <Trash2 className="w-5 h-5" />
                  <span className="font-medium">Papierkorb</span>
                  {deletedProjects.length > 0 && (
                    <span className="ml-auto text-xs bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full">
                      {deletedProjects.length}
                    </span>
                  )}
                </button>
              </div>
            </SheetContent>
          </Sheet>
          <h2 className="font-semibold text-lg">Ordner</h2>
        </div>

        <TrashDialog
          open={showTrashDialog}
          onClose={() => setShowTrashDialog(false)}
          deletedProjects={deletedProjects}
          onRestore={restoreProject}
          onPermanentDelete={permanentlyDeleteProject}
        />

        {search.trim() ? (
          <div className="flex-1 overflow-auto">
            <SearchList 
              results={searchResults} 
              open={(r) => { 
                setSelectedFolderId(r.folderId); 
                setSelectedProjectId(r.project.id); 
                setMobileLevel('project');
                setView("chat"); 
                setSearch(""); 
              }} 
            />
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4">
            <h2 className="text-xl font-bold mb-4">Ordner</h2>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : folders.filter(f => showArchived || !f.archived).length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                Noch keine Ordner vorhanden
              </div>
            ) : (
              <div className="space-y-2">
                {folders.filter(f => showArchived || !f.archived).map(folder => (
                  <button
                    key={folder.id}
                    onClick={() => {
                      setSelectedFolderId(folder.id);
                      setMobileLevel('projects');
                    }}
                    className="w-full p-4 bg-card border border-border rounded-lg text-left hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          📁 {folder.name}
                          {folder.archived && <span className="text-xs text-muted-foreground ml-2">(Archiv)</span>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {folder.projects.filter(p => showArchived || !p.archived).length} Projekt{folder.projects.filter(p => showArchived || !p.archived).length !== 1 ? 'e' : ''}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
  
  // Level 2: Projekt-Liste
  if (mobileLevel === 'projects' && selectedFolder) {
    const projects = selectedFolder.projects.filter(p => showArchived || !p.archived);
    
    return (
      <div className="h-full flex flex-col bg-background">
        {/* Header mit Zurück-Button */}
        <div className="h-14 border-b border-border px-4 flex items-center gap-3 bg-card">
          <button 
            onClick={() => {
              setMobileLevel('folders');
              setSelectedFolderId(null);
            }}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="font-semibold text-lg truncate">{selectedFolder.name}</h2>
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          {projects.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              Keine Projekte in diesem Ordner
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map(project => (
                <button
                  key={project.id}
                  onClick={() => {
                    setSelectedProjectId(project.id);
                    setView('chat');
                    setMobileLevel('project');
                  }}
                  className="w-full p-4 bg-card border border-border rounded-lg text-left hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-8 rounded-full ${project.archived ? "bg-muted-foreground" : "bg-success"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {project.title}
                        {project.auftragsnummer && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({project.auftragsnummer})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {project.projektstatus || "Kein Status"}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // Level 3: Projekt-Ansicht mit Tabs
  if (mobileLevel === 'project' && selectedProject) {
    return (
      <div className="h-full flex flex-col bg-background">
        {/* Header mit Hamburger Menu und Zurück-Button */}
        <div className="h-14 border-b border-border px-4 flex items-center gap-3 bg-card">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button className="p-2 hover:bg-accent rounded-lg transition-colors">
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-2">
                <button
                  onClick={() => {
                    setMobileLevel('folders');
                    setSelectedFolderId(null);
                    setSelectedProjectId(null);
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-accent transition-colors flex items-center gap-3"
                >
                  <span className="text-lg">🏠</span>
                  <span className="font-medium">Ordner-Übersicht</span>
                </button>
                {canAccessDashboard && (
                  <>
                    <button
                      onClick={() => {
                        // Future: Navigate to dashboard view
                        setMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 rounded-lg hover:bg-accent transition-colors flex items-center gap-3"
                    >
                      <span className="text-lg">📊</span>
                      <span className="font-medium">Dashboard</span>
                    </button>
                    <button
                      onClick={() => {
                        // Future: Navigate to calendar view
                        setMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 rounded-lg hover:bg-accent transition-colors flex items-center gap-3"
                    >
                      <span className="text-lg">📅</span>
                      <span className="font-medium">Kalender</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    setShowTrashDialog(true);
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-accent transition-colors flex items-center gap-3"
                >
                  <Trash2 className="w-5 h-5" />
                  <span className="font-medium">Papierkorb</span>
                  {deletedProjects.length > 0 && (
                    <span className="ml-auto text-xs bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full">
                      {deletedProjects.length}
                    </span>
                  )}
                </button>
              </div>
            </SheetContent>
          </Sheet>
          <button 
            onClick={() => {
              setMobileLevel('projects');
              setSelectedProjectId(null);
            }}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="font-semibold text-base truncate">{selectedProject.title}</h2>
        </div>

        <TrashDialog
          open={showTrashDialog}
          onClose={() => setShowTrashDialog(false)}
          deletedProjects={deletedProjects}
          onRestore={restoreProject}
          onPermanentDelete={permanentlyDeleteProject}
        />
        
        {/* View Content */}
        <div className="flex-1 overflow-auto">
          {view === "chat" ? (
            <ChatView project={selectedProject} />
          ) : view === "files" ? (
            <FilesView project={selectedProject} />
          ) : (
            <DetailsView project={selectedProject} />
          )}
        </div>
        
        {/* Bottom Tab Bar */}
        <div className="h-16 border-t border-border bg-card flex items-center justify-around px-4">
          <button
            onClick={() => setView('chat')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              view === 'chat' 
                ? 'bg-primary/10 text-primary' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="text-xl">💬</span>
            <span className="text-xs font-medium">Chat</span>
          </button>
          <button
            onClick={() => setView('files')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              view === 'files' 
                ? 'bg-primary/10 text-primary' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="text-xl">📁</span>
            <span className="text-xs font-medium">Dateien</span>
          </button>
          <button
            onClick={() => setView('details')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
              view === 'details' 
                ? 'bg-primary/10 text-primary' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="text-xl">📋</span>
            <span className="text-xs font-medium">Details</span>
          </button>
        </div>
      </div>
    );
  }
  
  return null;
}

function DashboardView({ 
  allProjects,
  setSelectedFolderId,
  setSelectedProjectId,
  setView
}: { 
  allProjects: { folderId: string; folder: Folder; project: Project }[];
  setSelectedFolderId: (id: string) => void;
  setSelectedProjectId: (id: string) => void;
  setView: (view: "chat" | "files" | "details" | "trash" | "dashboard" | "calendar") => void;
}) {
  const activeProjects = allProjects.filter(({ project }) => !project.archived);
  
  // Statistiken berechnen
  const totalProjects = activeProjects.length;
  const statusDistribution = activeProjects.reduce((acc, { project }) => {
    const status = project.projektstatus || "Kein Status";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Timeline-Daten (Projekte nach Startdatum)
  const timelineProjects = activeProjects
    .filter(({ project }) => project.details?.startdatum)
    .sort((a, b) => {
      const dateA = new Date(a.project.details?.startdatum || 0).getTime();
      const dateB = new Date(b.project.details?.startdatum || 0).getTime();
      return dateA - dateB;
    });

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Überschrift */}
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-foreground">📊 Dashboard</h2>
      </div>

      {/* Deadline Benachrichtigungen */}
      <DeadlineNotifications 
        allProjects={allProjects} 
        setSelectedFolderId={setSelectedFolderId}
        setSelectedProjectId={setSelectedProjectId}
        setView={setView}
      />

      {/* Statistik-Karten */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gesamtanzahl Projekte */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="text-sm text-muted-foreground mb-2">Aktive Projekte</div>
          <div className="text-4xl font-bold text-foreground">{totalProjects}</div>
        </div>

        {/* Projekte in Bearbeitung */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="text-sm text-muted-foreground mb-2">In Bearbeitung</div>
          <div className="text-4xl font-bold text-yellow-600">
            {statusDistribution["In Bearbeitung"] || 0}
          </div>
        </div>

        {/* Abgeschlossene Projekte */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="text-sm text-muted-foreground mb-2">Abgeschlossen</div>
          <div className="text-4xl font-bold text-green-600">
            {statusDistribution["Abgeschlossen"] || 0}
          </div>
        </div>
      </div>

      {/* Status-Verteilung */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-foreground mb-4">Status-Verteilung</h3>
        <div className="space-y-3">
          {Object.entries(statusDistribution).map(([status, count]) => (
            <div key={status} className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${STATUS_COLORS[status] || 'bg-gray-400'}`} />
              <div className="flex-1 flex items-center justify-between">
                <span className="text-sm text-foreground">{status}</span>
                <span className="text-sm font-semibold text-muted-foreground">{count}</span>
              </div>
              <div className="w-32 bg-muted rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${STATUS_COLORS[status] || 'bg-gray-400'}`}
                  style={{ width: `${(count / totalProjects) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline-Ansicht */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-foreground mb-4">📅 Projekt-Timeline</h3>
        <div className="space-y-2">
          {timelineProjects.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              Keine Projekte mit Startdatum vorhanden
            </div>
          ) : (
            timelineProjects.map(({ project, folder }) => {
              const startDate = project.details?.startdatum 
                ? new Date(project.details.startdatum).toLocaleDateString('de-DE')
                : '-';
              const endDate = project.details?.enddatum
                ? new Date(project.details.enddatum).toLocaleDateString('de-DE')
                : 'offen';
              
              return (
                <div 
                  key={project.id} 
                  className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-accent transition-colors"
                >
                  <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[project.projektstatus || "Kein Status"]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {project.title}
                      {project.auftragsnummer && (
                        <span className="text-xs text-muted-foreground ml-2">
                          ({project.auftragsnummer})
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      📁 {folder.name} • {project.projektstatus || "Kein Status"}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {startDate} → {endDate}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function HeaderBtn({ label, onClick, active }: { label: string; onClick: () => void; active: boolean }) {
  return (
    <button onClick={onClick} className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground hover:bg-accent"}`}>
      {label}
    </button>
  );
}

function FolderBlock({ f, selectedFolderId, selectedProjectId, setSelectedFolderId, setSelectedProjectId, showArchived, onDelete, onArchiveToggle, onMoveProject, onDeleteProject, onArchiveProject }: { f: Folder; selectedFolderId: string | null; selectedProjectId: string | null; setSelectedFolderId: (id: string) => void; setSelectedProjectId: (id: string | null) => void; showArchived: boolean; onDelete: (id: string) => void; onArchiveToggle: (id: string) => void; onMoveProject: (fid: string, pid: string) => void; onDeleteProject: (fid: string, pid: string) => void; onArchiveProject: (fid: string, pid: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showFolderMembersDialog, setShowFolderMembersDialog] = useState(false);
  const { canManageProjects } = useUserRole();
  
  return (
    <div>
      <div className="sticky top-0 z-10 bg-sidebar-accent px-4 py-3 text-sm font-semibold border-y border-sidebar-border flex items-center gap-2 group">
        <button className={`px-3 py-1.5 rounded-md transition-colors ${selectedFolderId === f.id ? "bg-card shadow-sm" : "hover:bg-card/50"}`} onClick={() => { setSelectedFolderId(f.id); setSelectedProjectId(null); }}>
          📁 {f.name}{f.archived ? " (Archiv)" : ""}
        </button>
        {canManageProjects && (
          <button 
            className="px-2 py-1 rounded-md border border-sidebar-border bg-card hover:bg-accent transition-colors opacity-0 group-hover:opacity-100"
            onClick={() => setShowFolderMembersDialog(true)}
            title="Ordner-Mitglieder verwalten"
          >
            <Users className="w-3.5 h-3.5" />
          </button>
        )}
        <div className="ml-auto relative">
          <button className="px-2.5 py-1 rounded-md border border-sidebar-border bg-card hover:bg-accent transition-colors" onClick={() => setMenuOpen((v) => !v)}>⋯</button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 text-sm min-w-[180px]">
              <button className="block w-full text-left px-4 py-2.5 hover:bg-accent transition-colors rounded-t-lg" onClick={() => { setMenuOpen(false); onArchiveToggle(f.id); }}>
                {f.archived ? "📤 Aus Archiv holen" : "📥 In Archiv"}
              </button>
              <button className="block w-full text-left px-4 py-2.5 hover:bg-accent transition-colors text-destructive rounded-b-lg" onClick={() => { setMenuOpen(false); onDelete(f.id); }}>
                🗑️ Ordner löschen
              </button>
            </div>
          )}
        </div>
      </div>
      <FolderMembersDialog 
        folderId={f.id}
        open={showFolderMembersDialog}
        onClose={() => setShowFolderMembersDialog(false)}
      />
      {selectedFolderId === f.id && (
        <ul className="divide-y divide-border">
          {f.projects.filter((p) => (showArchived || !p.archived)).length === 0 ? (
            <li className="px-4 py-4 text-sm text-muted-foreground">Keine Projekte vorhanden</li>
          ) : (
            f.projects.filter((p) => (showArchived || !p.archived)).map((p) => (
              <ProjectRow key={p.id} p={p} onOpen={() => { setSelectedProjectId(p.id); }} onMove={() => onMoveProject(f.id, p.id)} onDelete={() => onDeleteProject(f.id, p.id)} onArchive={() => onArchiveProject(f.id, p.id)} selected={!!selectedProjectId && p.id === selectedProjectId} />
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function ProjectRow({ p, onOpen, onMove, onDelete, onArchive, selected }: { p: Project; onOpen: () => void; onMove: () => void; onDelete: () => void; onArchive: () => void; selected: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <li onClick={onOpen} className={`grid grid-cols-[6px_1fr_auto] gap-3 px-4 py-3 cursor-pointer transition-colors ${selected ? "bg-accent" : "hover:bg-accent/50"}`}>
      <div className={`w-1.5 h-full ${p.archived ? "bg-muted-foreground" : "bg-success"} rounded-full`} />
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground truncate">
          {p.title}
          {p.auftragsnummer && (
            <span className="text-xs text-muted-foreground ml-2">
              ({p.auftragsnummer})
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {p.projektstatus || "Bauprojekt"}
        </div>
      </div>
      <div className="relative self-center">
        <button className="px-2.5 py-1 rounded-md border border-border hover:bg-accent transition-colors" onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}>⋯</button>
        {menuOpen && (
          <div className="absolute right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 text-sm min-w-[200px]">
            <button className="block w-full text-left px-4 py-2.5 hover:bg-accent transition-colors" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onMove(); }}>
              📂 In anderen Ordner
            </button>
            <button className="block w-full text-left px-4 py-2.5 hover:bg-accent transition-colors" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onArchive(); }}>
              {p.archived ? "📤 Aus Archiv holen" : "📥 Archivieren"}
            </button>
            <button className="block w-full text-left px-4 py-2.5 hover:bg-accent transition-colors text-destructive rounded-b-lg" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}>
              🗑️ Projekt löschen
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function ChatView({ project }: { project: Project }) {
  const [text, setText] = useState("");
  const { messages, sendMessage } = useMessages(project.id);
  const { uploadFile, isUploading, getFileUrl } = useProjectFiles(project.id);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-Scroll zu neuen Nachrichten
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendText = () => {
    const t = text.trim();
    if (!t) return;
    sendMessage({ type: "text", content: { text: t } });
    setText("");
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImage = file.type.startsWith('image/');
      const targetFolder = isImage ? 'Bilder' : 'Dokumente';
      
      // Upload in Zielordner (Bilder oder Dokumente)
      uploadFile({ file, folder: targetFolder }, {
        onSuccess: (data) => {
          // Chat-Nachricht mit Datei-Referenz erstellen
          const fileUrl = getFileUrl(data);
          sendMessage({
            type: isImage ? 'image' : 'file',
            content: {
              url: fileUrl,
              name: file.name,
              ext: data.ext,
              size: file.size,
              fileId: data.id, // Referenz zur Datei in project_files
            }
          });
        }
      });
    }
  };

  const handleAudioUpload = async (blob: Blob) => {
    const file = new File([blob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
    
    uploadFile({ file, folder: 'Sprachnachrichten' }, {
      onSuccess: (data) => {
        const fileUrl = getFileUrl(data);
        sendMessage({
          type: 'audio',
          content: {
            url: fileUrl,
            name: file.name,
            fileId: data.id,
          }
        });
      }
    });
  };

  const handleVideoUpload = async (blob: Blob) => {
    const file = new File([blob], `video_${Date.now()}.webm`, { type: 'video/webm' });
    
    uploadFile({ file, folder: 'Videos' }, {
      onSuccess: (data) => {
        const fileUrl = getFileUrl(data);
        sendMessage({
          type: 'video',
          content: {
            url: fileUrl,
            name: file.name,
            fileId: data.id,
          }
        });
      }
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-6 py-4 space-y-3"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm px-8 text-center">
            Noch keine Nachrichten.<br/>Starte die projektbezogene Unterhaltung.
          </div>
        ) : (
          <>
            {messages.map((m) => <MessageBubble key={m.id} msg={m} getFileUrl={getFileUrl} />)}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-border p-4 bg-card shadow-sm">
        <div className="flex items-center gap-2">
          <input 
            ref={imageInputRef}
            type="file" 
            accept="image/*,application/pdf,.pdf,video/*" 
            multiple 
            className="hidden" 
            onChange={(e) => { 
              handleImageUpload(e.target.files); 
              e.target.value = ""; 
            }} 
          />
          <button 
            onClick={() => imageInputRef.current?.click()} 
            className="p-2.5 rounded-lg border border-border bg-background hover:bg-accent transition-colors" 
            title="Datei anhängen"
            disabled={isUploading}
          >
            📎
          </button>
          <AudioRecorder onRecordingComplete={handleAudioUpload} />
          <VideoRecorder onRecordingComplete={handleVideoUpload} />
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } }} placeholder="Eine Nachricht schreiben…" className="flex-1 bg-secondary rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" />
          <button onClick={sendText} className="p-2.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground transition-all hover:scale-105 active:scale-95" title="Senden">➤</button>
        </div>
        <div className="text-xs text-muted-foreground mt-2">Enter = senden, Shift + Enter = neue Zeile</div>
      </div>
    </div>
  );
}

function AudioRecorder({ onRecordingComplete }: { onRecordingComplete: (blob: Blob) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onRecordingComplete(blob);
        stream.getTracks().forEach(track => track.stop());
        setRecordingTime(0);
        if (timerRef.current) clearInterval(timerRef.current);
      };

      mediaRecorder.start();
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Fehler beim Zugriff auf Mikrofon:', error);
      toast({
        title: 'Mikrofon-Zugriff verweigert',
        description: 'Bitte erlaube den Mikrofon-Zugriff in den Browser-Einstellungen.',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2">
      {!isRecording ? (
        <button
          onClick={startRecording}
          className="p-2.5 rounded-lg border border-border bg-background hover:bg-accent transition-colors"
          title="Sprachnachricht aufnehmen"
        >
          🎤
        </button>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/20 border border-red-500 rounded-lg">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-red-600 dark:text-red-400">{formatTime(recordingTime)}</span>
          <button
            onClick={stopRecording}
            className="ml-2 px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium transition-colors"
          >
            Stoppen
          </button>
        </div>
      )}
    </div>
  );
}

function VideoRecorder({ onRecordingComplete }: { onRecordingComplete: (blob: Blob) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' },
        audio: true 
      });
      
      streamRef.current = stream;
      
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }
      setShowPreview(true);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        onRecordingComplete(blob);
        stream.getTracks().forEach(track => track.stop());
        setRecordingTime(0);
        setShowPreview(false);
        if (timerRef.current) clearInterval(timerRef.current);
      };

      mediaRecorder.start();
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Fehler beim Zugriff auf Kamera:', error);
      toast({
        title: 'Kamera-Zugriff verweigert',
        description: 'Bitte erlaube den Kamera-Zugriff in den Browser-Einstellungen.',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {!isRecording ? (
        <button
          onClick={startRecording}
          className="p-2.5 rounded-lg border border-border bg-background hover:bg-accent transition-colors"
          title="Video aufnehmen"
        >
          🎥
        </button>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/20 border border-red-500 rounded-lg">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-red-600 dark:text-red-400">{formatTime(recordingTime)}</span>
          <button
            onClick={stopRecording}
            className="ml-2 px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium transition-colors"
          >
            Stoppen
          </button>
        </div>
      )}

      {showPreview && (
        <Modal onClose={stopRecording} title="Video-Aufnahme">
          <div className="relative">
            <video
              ref={videoPreviewRef}
              autoPlay
              muted
              className="w-full max-h-96 rounded-lg bg-black"
            />
            <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              REC {formatTime(recordingTime)}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

const MessageBubble = memo(function MessageBubble({ msg, getFileUrl }: { msg: any; getFileUrl?: any }) {
  const sender = msg.profile ? `${msg.profile.first_name} ${msg.profile.last_name}` : msg.sender || "Du";
  const timestamp = msg.timestamp || new Date().toISOString();
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  
  return (
    <div className="max-w-2xl bg-card rounded-lg p-3 shadow-sm border border-border">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <span className="font-semibold text-foreground">{sender}</span>
        <span>•</span>
        <span>{new Date(timestamp).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      
      {msg.type === "text" && <div className="text-sm text-foreground whitespace-pre-wrap">{msg.content?.text}</div>}
      
      {msg.type === "image" && (
        <img 
          src={msg.content?.url} 
          alt={msg.content?.name || "Bild"} 
          className="rounded-lg border border-border max-w-xs h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity" 
          onClick={() => window.open(msg.content?.url, '_blank')}
        />
      )}
      
      {msg.type === "audio" && (
        <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg border border-border">
          <div className="text-2xl">🎤</div>
          <audio 
            controls 
            src={msg.content?.url} 
            className="flex-1"
            controlsList="nodownload"
          />
        </div>
      )}
      
      {msg.type === "video" && (
        <div className="rounded-lg overflow-hidden border border-border bg-black">
          <video 
            controls 
            src={msg.content?.url} 
            className="w-full max-h-64"
            controlsList="nodownload"
          />
        </div>
      )}
      
      {msg.type === "file" && (
        <div>
          <div 
            className="flex items-center gap-3 p-3 bg-secondary rounded-lg border border-border cursor-pointer hover:bg-accent transition-colors"
            onClick={() => {
              const ext = msg.content?.ext?.toLowerCase() || '';
              if (ext === 'pdf' || ext === '.pdf') {
                setShowPdfPreview(true);
              } else {
                window.open(msg.content?.url, '_blank');
              }
            }}
          >
            <div className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary font-mono font-semibold">
              {(msg.content?.ext || "FILE").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{msg.content?.name}</div>
              <div className="text-xs text-muted-foreground">Klicke zum Öffnen</div>
            </div>
          </div>

          {showPdfPreview && (
            <Modal onClose={() => setShowPdfPreview(false)} title={msg.content?.name || "PDF"}>
              <div className="w-full h-[70vh] bg-muted rounded-lg overflow-hidden">
                <object 
                  data={msg.content?.url} 
                  type="application/pdf" 
                  className="w-full h-full"
                >
                  <iframe 
                    title="PDF Preview" 
                    src={msg.content?.url} 
                    className="w-full h-full"
                  />
                </object>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <a 
                  href={msg.content?.url} 
                  download 
                  className="px-4 py-2 rounded-lg border border-border bg-background hover:bg-accent transition-colors"
                >
                  ⬇️ Download
                </a>
                <a 
                  href={msg.content?.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
                >
                  In neuem Tab öffnen
                </a>
              </div>
            </Modal>
          )}
        </div>
      )}
      
      {msg.type === "info" && (<div className="text-xs text-muted-foreground italic">{msg.content?.text}</div>)}
    </div>
  );
});

function FilesView({ project }: { project: Project }) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [currentDir, setCurrentDir] = useState("Bilder");
  const [showNewDir, setShowNewDir] = useState(false);
  const [showRenameDir, setShowRenameDir] = useState<{ id: string; name: string } | null>(null);
  const [newDirName, setNewDirName] = useState("");
  const [preview, setPreview] = useState<{ url: string; mime: string; name: string; __temp: boolean } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  
  const { files: dbFiles, uploadFile, isUploading, getFileUrl, deleteFile, moveFile: dbMoveFile } = useProjectFiles(project.id);
  const { directories, createDirectory, renameDirectory, deleteDirectory } = useProjectDirectories(project.id);

  // Standard-Ordner + Datenbank-Ordner kombinieren, Duplikate vermeiden
  const standardDirs = ["Bilder", "Dokumente", "Chat", "Sprachnachrichten", "Videos"];
  const customDirs = directories.map(d => d.name);
  // Nur Standard-Ordner hinzufügen, die nicht bereits in der Datenbank existieren
  const uniqueStandardDirs = standardDirs.filter(std => !customDirs.includes(std));
  const listDirs = [...uniqueStandardDirs, ...customDirs];

  const addFiles = async (files: FileList | null, forceImage = false) => {
    if (!files || files.length === 0) return;
    
    const totalFiles = files.length;
    setUploadProgress({ current: 0, total: totalFiles });
    
    // Sequenziell hochladen für korrekten Fortschritt
    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      
      try {
        await new Promise((resolve, reject) => {
          uploadFile({ file, folder: currentDir }, {
            onSuccess: () => {
              setUploadProgress({ current: i + 1, total: totalFiles });
              resolve(true);
            },
            onError: (error: any) => {
              console.error('Upload error:', error);
              setUploadProgress({ current: i + 1, total: totalFiles });
              resolve(true); // Fortfahren trotz Fehler
            }
          });
        });
      } catch (error) {
        console.error('Failed to upload file:', file.name, error);
      }
    }
    
    // Nach 2 Sekunden Progress ausblenden
    setTimeout(() => setUploadProgress(null), 2000);
  };

  const makeDir = () => {
    const name = newDirName.trim();
    if (!name) return;
    
    // Prüfe ob der Name ein geschützter Standard-Ordner ist
    if (PROTECTED_FOLDERS.includes(name)) {
      toast({
        title: 'Name reserviert',
        description: `Der Name "${name}" ist für einen Standard-Ordner reserviert und kann nicht verwendet werden.`,
        variant: 'destructive',
      });
      return;
    }
    
    // Prüfe ob der Name bereits existiert
    if (listDirs.includes(name)) {
      toast({
        title: 'Ordner existiert bereits',
        description: `Ein Ordner mit dem Namen "${name}" existiert bereits`,
        variant: 'destructive',
      });
      return;
    }
    
    createDirectory(name);
    setNewDirName("");
    setShowNewDir(false);
  };

  const handleRenameDir = () => {
    if (!showRenameDir) return;
    
    // Prüfe ob es ein geschützter Ordner ist
    if (PROTECTED_FOLDERS.includes(showRenameDir.name)) {
      toast({
        title: 'Ordner geschützt',
        description: `Der Ordner "${showRenameDir.name}" ist ein Standard-Ordner und kann nicht umbenannt werden.`,
        variant: 'destructive',
      });
      setShowRenameDir(null);
      setNewDirName("");
      return;
    }
    
    const name = newDirName.trim();
    if (!name) return;
    
    // Prüfe ob der Name bereits existiert
    if (listDirs.includes(name) && name !== showRenameDir.name) {
      toast({
        title: 'Ordner existiert bereits',
        description: `Ein Ordner mit dem Namen "${name}" existiert bereits`,
        variant: 'destructive',
      });
      return;
    }
    
    renameDirectory({ id: showRenameDir.id, name });
    setShowRenameDir(null);
    setNewDirName("");
  };

  const handleDeleteDir = (dirName: string) => {
    // Prüfe ob es ein geschützter Ordner ist
    if (PROTECTED_FOLDERS.includes(dirName)) {
      toast({
        title: 'Ordner geschützt',
        description: `Der Ordner "${dirName}" ist ein Standard-Ordner und kann nicht gelöscht werden.`,
        variant: 'destructive',
      });
      return;
    }
    
    const dir = directories.find(d => d.name === dirName);
    if (!dir) {
      toast({
        title: 'Ordner nicht gefunden',
        description: `Der Ordner "${dirName}" wurde nicht in der Datenbank gefunden.`,
        variant: 'destructive',
      });
      return;
    }
    
    // Prüfe ob Dateien im Ordner sind
    const filesInFolder = dbFiles.filter(f => f.folder === dirName);
    if (filesInFolder.length > 0) {
      toast({
        title: 'Ordner nicht leer',
        description: `Der Ordner "${dirName}" enthält noch ${filesInFolder.length} Datei(en). Bitte erst alle Dateien löschen oder verschieben.`,
        variant: 'destructive',
      });
      return;
    }
    
    deleteDirectory(dir.id);
  };

  const moveFile = (fileId: string, newDir: string) => {
    if (!fileId || !newDir) return;
    
    // Finde die aktuelle Datei
    const file = dbFiles.find(f => f.id === fileId);
    if (!file) {
      console.error('File not found:', fileId);
      return;
    }
    
    // Prüfe ob die Datei bereits im Zielordner ist
    if (file.folder === newDir) {
      toast({
        title: 'Datei bereits vorhanden',
        description: `Die Datei befindet sich bereits in "${newDir}"`,
      });
      return;
    }
    
    // Verschiebe die Datei
    dbMoveFile({ fileId, newFolder: newDir });
  };
  
  const onDropToDir = (e: React.DragEvent, dir: string) => { 
    e.preventDefault(); 
    const fileId = e.dataTransfer.getData("text/id"); 
    if (!fileId) return; 
    moveFile(fileId, dir); 
  };
  
  const filesInDir = (dir: string) => dbFiles
    .filter((f) => (f.folder || "") === dir)
    .map((f) => ({
      id: f.id,
      name: f.name,
      url: getFileUrl(f),
      thumbUrl: getFileUrl(f),
      isImage: f.is_image,
      mime: f.mime || '',
      ext: f.ext || '',
      size: f.size || '',
      folder: f.folder || '',
      modified: f.modified || '',
      takenAt: f.taken_at || '',
    }));
    
  const openPreview = async (file: ProjectFile) => {
    try {
      const res = await fetch(file.url);
      const blob = await res.blob();
      const tempUrl = URL.createObjectURL(blob);
      setPreview({ url: tempUrl, mime: file.mime, name: file.name, __temp: true });
    } catch {
      setPreview({ url: file.url, mime: file.mime, name: file.name, __temp: false });
    }
  };
  
  const closePreview = () => {
    if (preview?.__temp) revokeUrlSafe(preview.url);
    setPreview(null);
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border bg-card shadow-sm">
        <div className="flex items-center gap-3">
          <strong className="text-sm">Verzeichnis:</strong>
          <select className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" value={currentDir} onChange={(e) => setCurrentDir(e.target.value)}>
            {listDirs.map((d) => (<option key={d} value={d}>{d}</option>))}
          </select>
          <button className="ml-2 px-3 py-2 text-sm rounded-lg border border-border bg-background hover:bg-accent transition-colors" onClick={() => setShowNewDir(true)}>+ Neuer Ordner</button>
        </div>
        <div className="flex items-center gap-2">
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files, true); e.target.value = ""; }} />
          <input ref={uploadRef} type="file" multiple accept="image/*,application/pdf,.pdf,application/*,text/*" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <button onClick={() => cameraRef.current?.click()} className="px-4 py-2 rounded-lg border border-border bg-background hover:bg-accent transition-colors">📷 Kamera</button>
          <button onClick={() => uploadRef.current?.click()} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground transition-all">📤 Dateien hochladen</button>
        </div>
      </div>

      {uploadProgress && (
        <div className="px-6 py-3 bg-card border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Dateien werden hochgeladen...</span>
                <span>{uploadProgress.current} / {uploadProgress.total}</span>
              </div>
              <Progress 
                value={(uploadProgress.current / uploadProgress.total) * 100} 
                className="h-2"
              />
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-3 flex flex-wrap gap-2 border-b border-border bg-secondary/50">
        {listDirs.map((d) => {
          const isProtected = PROTECTED_FOLDERS.includes(d);
          const isCustom = !isProtected;
          
          return (
            <div key={d} className="relative group">
              <button 
                type="button" 
                onClick={() => setCurrentDir(d)} 
                onDragOver={(e) => e.preventDefault()} 
                onDrop={(e) => onDropToDir(e, d)} 
                className={`px-4 py-2 rounded-full text-sm border transition-all ${
                  d === currentDir 
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm" 
                    : "border-border bg-background text-foreground hover:bg-accent"
                }`} 
                title={
                  isProtected 
                    ? `Klicken zum Öffnen • Dateien hierher ziehen • Geschützter Ordner` 
                    : `Klicken zum Öffnen • Dateien hierher ziehen, um nach "${d}" zu verschieben`
                }
              >
                📁 {d} {isProtected && "🔒"}
              </button>
              
              {/* Nur bei Custom-Ordnern: Umbenennen/Löschen Buttons anzeigen */}
              {isCustom && (
                <div className="absolute -top-1 -right-1 hidden group-hover:flex gap-1 bg-card border border-border rounded-md shadow-lg p-1 z-10">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const dir = directories.find(dir => dir.name === d);
                      if (dir) {
                        setShowRenameDir({ id: dir.id, name: dir.name });
                        setNewDirName(dir.name);
                      }
                    }}
                    className="px-2 py-1 text-xs hover:bg-accent rounded transition-colors"
                    title="Umbenennen"
                  >
                    ✏️
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDir(d);
                    }}
                    className="px-2 py-1 text-xs hover:bg-accent rounded transition-colors"
                    title="Löschen (nur wenn leer)"
                  >
                    🗑️
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <h4 className="font-semibold mb-4 text-lg">📂 {currentDir}</h4>
        {filesInDir(currentDir).length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-12">Keine Dateien im Verzeichnis vorhanden.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filesInDir(currentDir).map((f) => (<FileCard key={f.id} file={f} dirs={listDirs} onMove={moveFile} onOpen={() => openPreview(f)} />))}
          </div>
        )}
      </div>

      {showNewDir && (
        <Modal title="Neues Verzeichnis" onClose={() => { setShowNewDir(false); setNewDirName(""); }}>
          <div className="space-y-4">
            <Label>Ordnername</Label>
            <input autoFocus className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" value={newDirName} onChange={(e) => setNewDirName(e.target.value)} placeholder="z. B. Pläne, Abnahmen, Lieferscheine" />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => { setShowNewDir(false); setNewDirName(""); }}>Abbrechen</Button>
              <Button onClick={makeDir} disabled={!newDirName.trim()}>Erstellen</Button>
            </div>
          </div>
        </Modal>
      )}

      {showRenameDir && (
        <Modal title="Ordner umbenennen" onClose={() => { setShowRenameDir(null); setNewDirName(""); }}>
          <div className="space-y-4">
            <Label>Neuer Ordnername</Label>
            <input autoFocus className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" value={newDirName} onChange={(e) => setNewDirName(e.target.value)} placeholder="z. B. Pläne, Abnahmen, Lieferscheine" />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => { setShowRenameDir(null); setNewDirName(""); }}>Abbrechen</Button>
              <Button onClick={handleRenameDir} disabled={!newDirName.trim()}>Umbenennen</Button>
            </div>
          </div>
        </Modal>
      )}

      {preview && (
        <Modal title={preview.name} onClose={closePreview}>
          <div className="w-full h-[70vh] bg-secondary rounded-lg overflow-hidden">
            {(() => {
              const n = (preview.name || "").toLowerCase();
              const m = preview.mime || "";
              const isImg = m.startsWith("image/") || isImgName(n);
              const isPdf = m.includes("pdf") || isPdfName(n);
              if (isImg) return <img src={preview.url} alt={preview.name} className="w-full h-full object-contain" />;
              if (isPdf) return (<object data={preview.url} type="application/pdf" className="w-full h-full"><iframe title="PDF" src={preview.url} className="w-full h-full" /><div className="p-4 text-sm text-muted-foreground">PDF-Vorschau nicht verfügbar. Bitte herunterladen.</div></object>);
              return <iframe title="Datei" src={preview.url} className="w-full h-full" />;
            })()}
          </div>
          <div className="mt-4 flex justify-end"><a href={preview.url} download className="px-4 py-2 rounded-lg border border-border bg-background hover:bg-accent transition-colors">⬇️ Download</a></div>
        </Modal>
      )}
    </div>
  );
}

const FileCard = memo(function FileCard({ file, dirs, onMove, onOpen }: { file: ProjectFile; dirs: string[]; onMove: (id: string, dir: string) => void; onOpen: () => void }) {
  const [menu, setMenu] = useState(false);
  const IconComponent = getFileIcon(file.name, file.mime);
  const isImage = ((file.isImage === true) || (file.mime || "").startsWith("image/") || isImgName(file.name));
  
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card cursor-pointer group hover:shadow-md transition-all" draggable onDragStart={(e) => e.dataTransfer.setData("text/id", file.id)} onClick={onOpen} title={`${file.name}`}>
      {isImage ? (
        <img src={file.thumbUrl || file.url} alt={file.name} className="w-full h-36 object-cover" />
      ) : (
        <div className="w-full h-36 flex flex-col items-center justify-center bg-secondary gap-2">
          <IconComponent className="w-12 h-12 text-muted-foreground" />
          <div className="text-xs text-muted-foreground font-mono font-semibold">{(file.ext || "FILE").toUpperCase()}</div>
        </div>
      )}
      <div className="px-3 py-2 text-xs text-muted-foreground truncate flex items-center justify-between border-t border-border">
        <span className="truncate font-medium text-foreground">{file.name}</span>
        <div className="relative">
          <button onClick={(e) => { e.stopPropagation(); setMenu((v) => !v); }} className="px-2 py-1 rounded-md border border-border hover:bg-accent transition-colors" title="Aktionen">⋯</button>
          {menu && (
            <div className="absolute right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 text-sm min-w-[160px]">
              {dirs.map((d) => (
                <button key={d} onClick={(e) => { e.stopPropagation(); setMenu(false); if (d !== file.folder) onMove(file.id, d); }} className={`block w-full text-left px-4 py-2.5 hover:bg-accent transition-colors ${d === file.folder ? "text-primary font-semibold" : "text-foreground"}`}>
                  📂 {d}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

function DetailsView({ project }: { project: Project }) {
  const { details, saveDetails, isSaving } = useProjectDetails(project.id);
  const { canManageProjects } = useUserRole();
  const [activeTab, setActiveTab] = useState<'details' | 'members'>('details');
  
  const [form, setForm] = useState<ProjectDetailsData>({
    projektname: "",
    auftragsnummer: "",
    projektstatus: "",
    ansprechpartner: "",
    notiz: "",
    startdatum: "",
    enddatum: "",
    strasse: "",
    plz: "",
    stadt: "",
    land: "",
  });

  // Details aus DB laden
  useEffect(() => {
    if (details) {
      setForm({
        projektname: details.projektname || "",
        auftragsnummer: details.auftragsnummer || "",
        projektstatus: details.projektstatus || "",
        ansprechpartner: details.ansprechpartner || "",
        notiz: details.notiz || "",
        startdatum: details.startdatum || "",
        enddatum: details.enddatum || "",
        strasse: details.strasse || "",
        plz: details.plz || "",
        stadt: details.stadt || "",
        land: details.land || "",
      });
    }
  }, [details]);

  const update = (k: keyof ProjectDetailsData, v: string) => 
    setForm((prev) => ({ ...prev, [k]: v }));

  const save = () => {
    const cleanedForm = {
      ...form,
      startdatum: form.startdatum?.trim() || null,
      enddatum: form.enddatum?.trim() || null,
    };
    saveDetails(cleanedForm);
  };

  const reset = () => {
    if (details) {
      setForm({
        projektname: details.projektname || "",
        auftragsnummer: details.auftragsnummer || "",
        projektstatus: details.projektstatus || "",
        ansprechpartner: details.ansprechpartner || "",
        notiz: details.notiz || "",
        startdatum: details.startdatum || "",
        enddatum: details.enddatum || "",
        strasse: details.strasse || "",
        plz: details.plz || "",
        stadt: details.stadt || "",
        land: details.land || "",
      });
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab Navigation */}
      <div className="border-b border-border bg-card px-6 flex gap-4">
        <button
          onClick={() => setActiveTab('details')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'details' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          📋 Projektdetails
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'members' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="w-4 h-4 inline mr-1.5" />
          Mitglieder
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'details' ? (
          <div className="p-6 space-y-6">
            <Field label="Projektname">
        <input 
          className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" 
          value={form.projektname || ""} 
          onChange={(e) => update("projektname", e.target.value)} 
        />
      </Field>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Startdatum">
          <input 
            type="date" 
            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" 
            value={form.startdatum || ""} 
            onChange={(e) => update("startdatum", e.target.value)} 
          />
        </Field>
        <Field label="Enddatum">
          <input 
            type="date" 
            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" 
            value={form.enddatum || ""} 
            onChange={(e) => update("enddatum", e.target.value)} 
          />
        </Field>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Auftragsnummer">
          <input 
            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" 
            value={form.auftragsnummer || ""} 
            onChange={(e) => update("auftragsnummer", e.target.value)} 
          />
        </Field>
        <Field label="Projektstatus">
          <select 
            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all cursor-pointer"
            value={form.projektstatus || ""} 
            onChange={(e) => update("projektstatus", e.target.value)}
          >
            <option value="">-- Status wählen --</option>
            {PROJECT_STATUS_OPTIONS.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Ansprechpartner">
        <input 
          className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" 
          value={form.ansprechpartner || ""} 
          onChange={(e) => update("ansprechpartner", e.target.value)} 
          placeholder="Name des Hauptansprechpartners"
        />
      </Field>

      <div className="space-y-3">
        <div className="text-sm font-semibold text-foreground">📍 Adresse</div>
        <Field label="Straße">
          <input 
            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" 
            value={form.strasse || ""} 
            onChange={(e) => update("strasse", e.target.value)} 
          />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="PLZ">
            <input 
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" 
              value={form.plz || ""} 
              onChange={(e) => update("plz", e.target.value)} 
            />
          </Field>
          <Field label="Stadt">
            <input 
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" 
              value={form.stadt || ""} 
              onChange={(e) => update("stadt", e.target.value)} 
            />
          </Field>
          <Field label="Land">
            <input 
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" 
              value={form.land || ""} 
              onChange={(e) => update("land", e.target.value)} 
            />
          </Field>
        </div>
      </div>

      <Field label="Projektnotiz">
        <textarea 
          className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" 
          rows={5}
          value={form.notiz || ""} 
          onChange={(e) => update("notiz", e.target.value)}
          placeholder="Allgemeine Notizen zum Projekt..."
        />
      </Field>

      <div className="flex justify-end gap-3 pt-6 border-t border-border">
        <Button variant="ghost" onClick={reset}>Zurücksetzen</Button>
        <Button onClick={save} disabled={isSaving}>
          {isSaving ? "Speichere..." : "💾 Speichern"}
        </Button>
      </div>

      {/* Notizen Sektion */}
      <NotesSection projectId={project.id} />

      {/* Kontakte Sektion */}
      <ContactsSection projectId={project.id} />
          </div>
        ) : (
          <DetailsViewMembersTab projectId={project.id} canManageProjects={canManageProjects} />
        )}
      </div>
    </div>
  );
}

function NotesSection({ projectId }: { projectId: string }) {
  const [newNote, setNewNote] = useState("");
  const { notes, addNote, deleteNote, isAdding } = useNotes(projectId);

  const handleAddNote = () => {
    const text = newNote.trim();
    if (!text) return;
    addNote(text);
    setNewNote("");
  };

  return (
    <div className="space-y-3 pt-6 border-t border-border">
      <div className="text-sm font-semibold text-foreground">📝 Notizen</div>
      <div className="flex gap-2 items-start">
        <textarea 
          className="flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" 
          rows={3} 
          value={newNote} 
          onChange={(e) => setNewNote(e.target.value)} 
          placeholder="Neue Notiz hinzufügen…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
              handleAddNote();
            }
          }}
        />
        <Button onClick={handleAddNote} disabled={!newNote.trim() || isAdding}>
          Hinzufügen
        </Button>
      </div>
      <div className="space-y-2">
        {notes.length === 0 ? (
          <div className="text-sm text-muted-foreground p-4 bg-secondary rounded-lg text-center">
            Keine Notizen vorhanden
          </div>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="flex items-start gap-3 border border-border rounded-lg p-3 bg-card">
              <div className="text-xs text-muted-foreground min-w-[140px] font-mono">
                {new Date(note.created_at).toLocaleString("de-DE")}
              </div>
              <div className="flex-1 text-sm whitespace-pre-wrap">{note.text}</div>
              <button 
                className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-accent transition-colors" 
                onClick={() => deleteNote(note.id)}
              >
                🗑️
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DetailsViewMembersTab({ projectId, canManageProjects }: { projectId: string; canManageProjects: boolean }) {
  const { user } = useAuth();
  const { members, isLoading, addMember, removeMember, leaveProject, isAdding, isRemoving } = useProjectMembers(projectId);
  const { users } = useOrganizationUsers();
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const isMember = members.some(m => m.user_id === user?.id);
  
  const availableUsers = users.filter(
    u => !members.some(m => m.user_id === u.user_id)
  );

  const handleAdd = () => {
    if (!selectedUserId) return;
    addMember(selectedUserId);
    setSelectedUserId("");
  };

  const handleLeave = () => {
    if (confirm("Möchtest du dieses Projekt wirklich verlassen?")) {
      leaveProject();
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Projekt-Mitglieder</h3>
        <p className="text-sm text-muted-foreground">
          Verwalte die Zugriffsberechtigung für dieses Projekt
        </p>
      </div>

      {canManageProjects && (
        <div className="border border-border rounded-lg p-4 bg-card space-y-3">
          <div className="text-sm font-medium">Mitglied hinzufügen</div>
          <div className="flex gap-2">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-all"
            >
              <option value="">Benutzer auswählen...</option>
              {availableUsers.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.first_name} {u.last_name} ({u.email})
                </option>
              ))}
            </select>
            <Button onClick={handleAdd} disabled={!selectedUserId || isAdding}>
              <UserPlus className="w-4 h-4 mr-2" />
              Hinzufügen
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="text-sm font-medium">Zugewiesene Mitglieder ({members.length})</div>
        {members.length === 0 ? (
          <div className="text-sm text-muted-foreground p-8 bg-secondary rounded-lg text-center">
            Noch keine Mitglieder zugewiesen
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 border border-border rounded-lg bg-card"
              >
                <div>
                  <div className="font-medium text-sm">
                    {member.profile?.first_name} {member.profile?.last_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {member.profile?.email}
                  </div>
                </div>
                {canManageProjects && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm(`${member.profile?.first_name} ${member.profile?.last_name} aus dem Projekt entfernen?`)) {
                        removeMember(member.user_id);
                      }
                    }}
                    disabled={isRemoving}
                  >
                    Entfernen
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {!canManageProjects && isMember && (
        <div className="pt-4 border-t border-border">
          <Button
            variant="ghost"
            onClick={handleLeave}
            className="w-full text-destructive hover:bg-destructive/10"
          >
            Projekt verlassen
          </Button>
        </div>
      )}
    </div>
  );
}

function ContactsSection({ projectId }: { projectId: string }) {
  const [newContact, setNewContact] = useState({ name: "", email: "", phone: "" });
  const { contacts, addContact, deleteContact, isAdding } = useContacts(projectId);

  const handleAddContact = () => {
    if (!newContact.name.trim() && !newContact.email.trim() && !newContact.phone.trim()) {
      return;
    }
    addContact(newContact);
    setNewContact({ name: "", email: "", phone: "" });
  };

  return (
    <div className="space-y-3 pt-6 border-t border-border">
      <div className="text-sm font-semibold text-foreground">👥 Ansprechpartner</div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-muted-foreground font-medium">Name</span>
          <input 
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" 
            value={newContact.name} 
            onChange={(e) => setNewContact((s) => ({ ...s, name: e.target.value }))} 
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-muted-foreground font-medium">E-Mail</span>
          <input 
            type="email"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" 
            value={newContact.email} 
            onChange={(e) => setNewContact((s) => ({ ...s, email: e.target.value }))} 
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-muted-foreground font-medium">Telefon</span>
          <input 
            type="tel"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" 
            value={newContact.phone} 
            onChange={(e) => setNewContact((s) => ({ ...s, phone: e.target.value }))} 
          />
        </label>
        <Button onClick={handleAddContact} disabled={isAdding}>
          Hinzufügen
        </Button>
      </div>
      <div className="space-y-2">
        {contacts.length === 0 ? (
          <div className="text-sm text-muted-foreground p-4 bg-secondary rounded-lg text-center">
            Keine Ansprechpartner
          </div>
        ) : (
          contacts.map((contact) => (
            <div key={contact.id} className="flex items-center gap-4 border border-border rounded-lg p-3 text-sm bg-card">
              <div className="font-semibold">{contact.name || "–"}</div>
              <div className="text-muted-foreground">{contact.email || "–"}</div>
              <div className="text-muted-foreground">{contact.phone || "–"}</div>
              <button 
                className="ml-auto text-xs px-3 py-1.5 border border-border rounded-md hover:bg-accent transition-colors" 
                onClick={() => deleteContact(contact.id)}
              >
                🗑️
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DetailsSidebar({ project }: { project: Project }) {
  const { details, isLoading: detailsLoading } = useProjectDetails(project.id);
  const { notes, isLoading: notesLoading } = useNotes(project.id);
  const { contacts, isLoading: contactsLoading } = useContacts(project.id);
  
  if (detailsLoading || notesLoading || contactsLoading) {
    return (
      <div className="w-full h-full overflow-auto p-6">
        <Skeleton className="h-6 w-full mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
      </div>
    );
  }
  
  return (
    <div className="w-full h-full overflow-auto p-6 space-y-4 text-sm">
      <div className="font-bold text-base mb-4 pb-3 border-b border-border">📋 Projektdetails</div>
      <InfoRow k="Projektname" v={details?.projektname || "–"} />
      <InfoRow k="Startdatum" v={details?.startdatum || "–"} />
      <InfoRow k="Enddatum" v={details?.enddatum || "–"} />
      <InfoRow k="Auftragsnummer" v={details?.auftragsnummer || "–"} />
      <InfoRow k="Projektstatus" v={details?.projektstatus || "–"} />
      
      <div className="pt-4">
        <div className="text-muted-foreground font-semibold mb-2">👥 Ansprechpartner</div>
        {contacts.length === 0 ? (
          <div className="text-muted-foreground">–</div>
        ) : (
          <div className="space-y-2">
            {contacts.map((c) => (
              <div key={c.id} className="p-2 bg-secondary rounded-md">
                <div className="font-semibold">{c.name || "–"}</div>
                <div className="text-xs text-muted-foreground">{c.email || "–"}</div>
                <div className="text-xs text-muted-foreground">{c.phone || "–"}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="pt-4">
        <div className="text-muted-foreground font-semibold mb-2">📝 Notizen</div>
        {notes.length === 0 ? (
          <div className="text-muted-foreground">–</div>
        ) : (
          <div className="space-y-2">
            {notes.map((n) => (
              <div key={n.id} className="p-2 bg-secondary rounded-md">
                <div className="text-xs text-muted-foreground font-mono mb-1">
                  {new Date(n.created_at).toLocaleString("de-DE")}
                </div>
                <div className="whitespace-pre-wrap text-xs">{n.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TrashView({ 
  deletedProjects, 
  onRestore, 
  onPermanentDelete 
}: { 
  deletedProjects: any[]; 
  onRestore: (id: string) => void; 
  onPermanentDelete: (id: string) => void; 
}) {
  const { allDetails } = useAllProjectDetails();
  
  return (
    <div className="p-4 space-y-2">
      {deletedProjects.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-12">
          <Trash2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <div>Papierkorb ist leer</div>
        </div>
      ) : (
        deletedProjects.map((p) => {
          const details = allDetails.find(d => d.project_id === p.id);
          return (
            <div key={p.id} className="border border-border rounded-lg p-3 bg-card space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {p.title}
                    {details?.auftragsnummer && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({details.auftragsnummer})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Gelöscht: {new Date(p.deleted_at).toLocaleDateString('de-DE')}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (confirm(`Projekt "${p.title}" wiederherstellen?`)) {
                      onRestore(p.id);
                    }
                  }}
                  className="flex-1 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary-hover rounded-md transition-colors flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Wiederherstellen
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Projekt "${p.title}" DAUERHAFT löschen? Diese Aktion kann nicht rückgängig gemacht werden!`)) {
                      onPermanentDelete(p.id);
                    }
                  }}
                  className="flex-1 px-3 py-1.5 text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md transition-colors flex items-center justify-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  Endgültig löschen
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function ExportDialog({ project, onClose, allDetails }: { project: Project; onClose: () => void; allDetails: any[] }) {
  const { details } = useProjectDetails(project.id);
  const { notes } = useNotes(project.id);
  const { contacts } = useContacts(project.id);
  const { messages } = useMessages(project.id);
  const { files, getFileUrl } = useProjectFiles(project.id);
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportProgress, setExportProgress] = React.useState({ current: 0, total: 0, fileName: '' });
  const [showZipOptions, setShowZipOptions] = React.useState(false);
  const [selectedFolders, setSelectedFolders] = React.useState<string[]>([]);
  
  // Verfügbare Ordner ermitteln
  const availableFolders = React.useMemo(() => {
    const folders = new Set<string>();
    files?.forEach(file => {
      folders.add(file.folder || 'Sonstige');
    });
    return Array.from(folders).sort();
  }, [files]);

  // Alle Ordner standardmäßig auswählen
  React.useEffect(() => {
    if (availableFolders.length > 0 && selectedFolders.length === 0) {
      setSelectedFolders(availableFolders);
    }
  }, [availableFolders]);

  const toggleFolder = (folder: string) => {
    setSelectedFolders(prev => 
      prev.includes(folder) 
        ? prev.filter(f => f !== folder)
        : [...prev, folder]
    );
  };

  const toggleAllFolders = () => {
    if (selectedFolders.length === availableFolders.length) {
      setSelectedFolders([]);
    } else {
      setSelectedFolders(availableFolders);
    }
  };
  
  const handleWordExport = async () => {
    await exportProjectToWord(
      project,
      details,
      notes || [],
      contacts || [],
      messages || []
    );
    onClose();
    toast({ title: 'Word-Export erfolgreich' });
  };

  
  const handleExcelExport = () => {
    exportProjectsToExcel([{ ...project, created_at: project.created_at || new Date().toISOString() }], allDetails);
    onClose();
    toast({ title: 'Excel-Export erfolgreich' });
  };

  const handleZipExport = async () => {
    if (selectedFolders.length === 0) {
      toast({
        title: 'Keine Ordner ausgewählt',
        description: 'Bitte wähle mindestens einen Ordner aus.',
        variant: 'destructive'
      });
      return;
    }

    setIsExporting(true);
    setExportProgress({ current: 0, total: 0, fileName: '' });
    
    try {
      await exportProjectAsZip(
        project,
        details,
        notes || [],
        contacts || [],
        messages || [],
        files || [],
        getFileUrl,
        selectedFolders,
        (current, total, fileName) => {
          setExportProgress({ current, total, fileName });
        }
      );
      toast({ title: 'ZIP-Export erfolgreich' });
      onClose();
    } catch (error) {
      console.error('ZIP-Export Fehler:', error);
      toast({ 
        title: 'ZIP-Export fehlgeschlagen', 
        description: 'Bitte versuche es erneut.',
        variant: 'destructive' 
      });
    } finally {
      setIsExporting(false);
      setExportProgress({ current: 0, total: 0, fileName: '' });
    }
  };
  
  return (
    <Modal title="Projekt exportieren" onClose={onClose}>
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground mb-4">
          Wählen Sie das gewünschte Export-Format für das Projekt "{project.title}".
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={handleWordExport}
            className="w-full px-6 py-4 rounded-lg border-2 border-border bg-card hover:bg-accent transition-colors text-left flex items-center gap-4"
          >
            <FileText className="w-8 h-8 text-primary" />
            <div>
              <div className="font-semibold">Word-Export (.docx)</div>
              <div className="text-xs text-muted-foreground">Editierbare Dokumentation mit Logo, Details und Chat-Verlauf</div>
            </div>
          </button>
          <button
            onClick={handleExcelExport}
            className="w-full px-6 py-4 rounded-lg border-2 border-border bg-card hover:bg-accent transition-colors text-left flex items-center gap-4"
          >
            <Download className="w-8 h-8 text-success" />
            <div>
              <div className="font-semibold">Excel-Export</div>
              <div className="text-xs text-muted-foreground">Alle Projekte als Tabelle exportieren</div>
            </div>
          </button>
          
          {/* ZIP Export mit erweiterten Optionen */}
          <div className="border-2 border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setShowZipOptions(!showZipOptions)}
              className="w-full px-6 py-4 bg-card hover:bg-accent transition-colors text-left flex items-center gap-4"
            >
              <Archive className="w-8 h-8 text-blue-500" />
              <div className="flex-1">
                <div className="font-semibold">Komplettes Projekt (.zip)</div>
                <div className="text-xs text-muted-foreground">
                  Word-Dokumentation + Dateien in Ordner-Struktur
                </div>
              </div>
              <ChevronRight className={`w-5 h-5 transition-transform ${showZipOptions ? 'rotate-90' : ''}`} />
            </button>

            {showZipOptions && (
              <div className="px-6 py-4 border-t border-border bg-secondary/30">
                {/* Ordner-Auswahl */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Ordner auswählen:</span>
                    <button
                      onClick={toggleAllFolders}
                      className="text-xs text-primary hover:underline"
                    >
                      {selectedFolders.length === availableFolders.length ? 'Keine' : 'Alle'} auswählen
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {availableFolders.map(folder => {
                      const fileCount = files?.filter(f => (f.folder || 'Sonstige') === folder).length || 0;
                      return (
                        <label
                          key={folder}
                          className="flex items-center gap-2 p-2 rounded-md hover:bg-accent cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedFolders.includes(folder)}
                            onChange={() => toggleFolder(folder)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm flex-1">
                            📁 {folder}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({fileCount})
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Fortschrittsanzeige */}
                {isExporting && (
                  <div className="mb-4 p-3 rounded-md bg-card border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Exportiere...</span>
                      <span className="text-xs text-muted-foreground">
                        {exportProgress.current} / {exportProgress.total}
                      </span>
                    </div>
                    <Progress 
                      value={exportProgress.total > 0 ? (exportProgress.current / exportProgress.total) * 100 : 0} 
                      className="mb-2"
                    />
                    <div className="text-xs text-muted-foreground truncate">
                      {exportProgress.fileName}
                    </div>
                  </div>
                )}

                {/* Export Button */}
                <button
                  onClick={handleZipExport}
                  disabled={isExporting || selectedFolders.length === 0}
                  className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isExporting ? 'Wird exportiert...' : 'ZIP-Export starten'}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
        </div>
      </div>
    </Modal>
  );
}

function SearchList({ results, open }: { results: { folderId: string; folder: Folder; project: Project }[]; open: (r: any) => void }) {
  return (
    <div className="p-4 space-y-2">
      {results.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">Keine Treffer gefunden</div>
      ) : (
        results.map((r) => (
          <button key={r.project.id} onClick={() => open(r)} className="w-full text-left px-4 py-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors shadow-sm">
            <div className="text-sm font-semibold text-foreground">
              {r.project.title}
              {r.project.auftragsnummer && (
                <span className="text-xs text-muted-foreground ml-2">
                  ({r.project.auftragsnummer})
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              📁 {r.folder.name}{r.folder.archived ? " (Archiv)" : ""}
              {r.project.projektstatus && (
                <span className="ml-2">• {r.project.projektstatus}</span>
              )}
            </div>
          </button>
        ))
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { 
  return (<label className="flex flex-col gap-2"><span className="text-sm text-muted-foreground font-medium">{label}</span>{children}</label>); 
}

function InfoRow({ k, v }: { k: string; v: string }) { 
  return (<div className="flex justify-between gap-3 py-2 border-b border-dashed border-border"><div className="text-muted-foreground">{k}</div><div className="text-foreground text-right font-medium">{v}</div></div>); 
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) { 
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-2xl rounded-xl bg-card shadow-xl border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-bold text-lg truncate">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-xl" aria-label="Schließen">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  ); 
}

function Button({ children, variant = "solid", ...props }: { children: React.ReactNode; variant?: "solid" | "ghost"; [key: string]: any }) { 
  const base = "px-4 py-2 text-sm rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"; 
  const styles = variant === "ghost" ? "border border-border text-foreground hover:bg-accent" : "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm hover:shadow"; 
  return (<button className={`${base} ${styles}`} {...props}>{children}</button>); 
}

function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) { 
  return <div className={`text-sm font-medium text-foreground ${className}`}>{children}</div>; 
}
