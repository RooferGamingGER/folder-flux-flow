import React, { useMemo, useRef, useState, useEffect, useCallback, memo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useFolders } from "@/hooks/useFolders";
import { useProjects } from "@/hooks/useProjects";
import { useMessages } from "@/hooks/useMessages";
import { useProjectFiles } from "@/hooks/useProjectFiles";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

const uid = (pfx = "id_") => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : pfx + Math.random().toString(36).slice(2, 10));

const tsFileSuffix = (d = new Date()) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
};

const isImgName = (name = "") => /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(name);
const isPdfName = (name = "") => /\.pdf$/i.test(name);

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
  type: "text" | "image" | "file" | "info";
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
  const { user } = useAuth();
  const { folders: dbFolders, isLoading: foldersLoading, createFolder: dbCreateFolder, deleteFolder: dbDeleteFolder, toggleArchive: dbToggleArchive } = useFolders();
  const { projects: dbProjects, isLoading: projectsLoading, createProject: dbCreateProject, deleteProject: dbDeleteProject, toggleArchive: dbToggleProjectArchive } = useProjects();
  
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [view, setView] = useState<"chat" | "files" | "details">("chat");

  const [showFolderDlg, setShowFolderDlg] = useState(false);
  const [showProjectDlg, setShowProjectDlg] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [projectFolderId, setProjectFolderId] = useState("");

  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [moveDlg, setMoveDlg] = useState<{ folderId: string; projectId: string; targetId: string } | null>(null);

  // Transform DB data to UI format (denormalize)
  const folders = useMemo(() => {
    if (!dbFolders || !dbProjects) return [];
    
    return dbFolders.map(folder => ({
      id: folder.id,
      name: folder.name,
      archived: folder.archived,
      projects: dbProjects
        .filter(p => p.folder_id === folder.id)
        .map(p => ({
          id: p.id,
          title: p.title,
          archived: p.archived,
          dirs: ["Bilder", "Dokumente"], // Default directories
          messages: [],
          files: [],
          details: {
            projektname: p.title,
            startdatum: "",
            enddatum: "",
            auftragsnummer: "",
            projektstatus: "",
            notiz: "",
            strasse: "",
            plz: "",
            stadt: "",
            land: "",
            ansprechpartner: "",
            notes: [],
            contacts: [],
          },
        }))
    }));
  }, [dbFolders, dbProjects]);

  const isLoading = foldersLoading || projectsLoading;

  const selectedFolder = useMemo(() => folders.find((f) => f.id === selectedFolderId) || null, [folders, selectedFolderId]);
  const selectedProject = useMemo(() => {
    const f = folders.find((x) => x.id === selectedFolderId);
    return f ? f.projects.find((p) => p.id === selectedProjectId) || null : null;
  }, [folders, selectedFolderId, selectedProjectId]);

  function openFolderDialog() {
    setFolderName("");
    setShowFolderDlg(true);
    setFabOpen(false);
  }
  function openProjectDialog() {
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
      return project.title.toLowerCase().includes(q);
    });
  }, [search, allProjects, showArchived]);

  return (
    <div className="h-screen w-full bg-background text-foreground">
      <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-3 shadow-sm">
        <div className="flex items-center gap-3 min-w-[180px]">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">🏗️</div>
          <div className="text-base font-semibold">Aktuelle Baustellen</div>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Projekte suchen…"
            className="w-56 md:w-72 bg-secondary rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-all"
          />
          <label className="text-sm flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-primary" /> 
            <span className="text-muted-foreground">Archiv anzeigen</span>
          </label>
        </div>
      </header>

      <div className="h-[calc(100vh-56px)] grid grid-cols-1 md:grid-cols-[320px_1fr] xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <aside className="border-r border-border bg-sidebar relative overflow-hidden">
          <div className="absolute inset-0 overflow-auto">
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
                  <button onClick={openFolderDialog} className="w-full text-left px-4 py-2.5 rounded-md hover:bg-accent text-sm font-medium transition-colors">
                    📁 Neuen Ordner erstellen
                  </button>
                  <button onClick={openProjectDialog} className="w-full text-left px-4 py-2.5 rounded-md hover:bg-accent text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={folders.length === 0}>
                    🏗️ Neues Projekt anlegen
                  </button>
                  {folders.length === 0 && (<div className="px-4 pb-1 text-xs text-muted-foreground">Erst einen Ordner anlegen</div>)}
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
            {selectedProject && (
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <HeaderBtn label="💬 Chat" active={view === "chat"} onClick={() => setView("chat")} />
                <HeaderBtn label="📁 Dateien" active={view === "files"} onClick={() => setView("files")} />
                <HeaderBtn label="📋 Details" active={view === "details"} onClick={() => setView("details")} />
              </div>
            )}
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
  return (
    <div>
      <div className="sticky top-0 z-10 bg-sidebar-accent px-4 py-3 text-sm font-semibold border-y border-sidebar-border flex items-center gap-2">
        <button className={`px-3 py-1.5 rounded-md transition-colors ${selectedFolderId === f.id ? "bg-card shadow-sm" : "hover:bg-card/50"}`} onClick={() => { setSelectedFolderId(f.id); setSelectedProjectId(null); }}>
          📁 {f.name}{f.archived ? " (Archiv)" : ""}
        </button>
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
        <div className="text-sm font-medium text-foreground truncate">{p.title}</div>
        <div className="text-xs text-muted-foreground truncate">Bauprojekt</div>
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

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 overflow-auto px-6 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm px-8 text-center">
            Noch keine Nachrichten.<br/>Starte die projektbezogene Unterhaltung.
          </div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} msg={m} />)
        )}
      </div>

      <div className="border-t border-border p-4 bg-card shadow-sm">
        <div className="flex items-center gap-2">
          <input 
            ref={imageInputRef}
            type="file" 
            accept="image/*,application/pdf,.pdf" 
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
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } }} placeholder="Eine Nachricht schreiben…" className="flex-1 bg-secondary rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" />
          <button onClick={sendText} className="p-2.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground transition-all hover:scale-105 active:scale-95" title="Senden">➤</button>
        </div>
        <div className="text-xs text-muted-foreground mt-2">Enter = senden, Shift + Enter = neue Zeile</div>
      </div>
    </div>
  );
}

const MessageBubble = memo(function MessageBubble({ msg }: { msg: any }) {
  const sender = msg.profile ? `${msg.profile.first_name} ${msg.profile.last_name}` : msg.sender || "Du";
  const timestamp = msg.timestamp || new Date().toISOString();
  
  return (
    <div className="max-w-2xl bg-card rounded-lg p-3 shadow-sm border border-border">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <span className="font-semibold text-foreground">{sender}</span>
        <span>•</span>
        <span>{new Date(timestamp).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      {msg.type === "text" && <div className="text-sm text-foreground whitespace-pre-wrap">{msg.content?.text}</div>}
      {msg.type === "image" && (<img src={msg.content?.url} alt={msg.content?.name || "Bild"} className="rounded-lg border border-border max-w-xs h-32 object-cover" />)}
      {msg.type === "file" && (
        <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg border border-border">
          <div className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary font-mono font-semibold">{(msg.content?.ext || "FILE").toUpperCase()}</div>
          <div className="text-sm truncate">{msg.content?.name}</div>
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
  const [newDirName, setNewDirName] = useState("");
  const [preview, setPreview] = useState<{ url: string; mime: string; name: string; __temp: boolean } | null>(null);
  
  const { files: dbFiles, uploadFile, isUploading, getFileUrl, deleteFile, moveFile: dbMoveFile } = useProjectFiles(project.id);

  const listDirs = ["Bilder", "Dokumente", "Chat"];

  const addFiles = async (files: FileList | null, forceImage = false) => {
    if (!files || files.length === 0) return;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      uploadFile({ file, folder: currentDir });
    }
  };

  const makeDir = () => {
    console.log("Directory management not yet implemented");
    setShowNewDir(false);
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

      <div className="px-4 py-3 flex flex-wrap gap-2 border-b border-border bg-secondary/50">
        {listDirs.map((d) => (
          <button type="button" key={d} onClick={() => setCurrentDir(d)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDropToDir(e, d)} className={`px-4 py-2 rounded-full text-sm border transition-all ${d === currentDir ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm" : "border-border bg-background text-foreground hover:bg-accent"}`} title={`Klicken zum Öffnen • Dateien hierher ziehen, um nach "${d}" zu verschieben`}>
            📁 {d}
          </button>
        ))}
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
        <Modal title="Neues Verzeichnis" onClose={() => setShowNewDir(false)}>
          <div className="space-y-4">
            <Label>Ordnername</Label>
            <input autoFocus className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" value={newDirName} onChange={(e) => setNewDirName(e.target.value)} placeholder="z. B. Pläne, Abnahmen, Lieferscheine" />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowNewDir(false)}>Abbrechen</Button>
              <Button onClick={makeDir} disabled={!newDirName.trim()}>Erstellen</Button>
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
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card cursor-pointer group hover:shadow-md transition-all" draggable onDragStart={(e) => e.dataTransfer.setData("text/id", file.id)} onClick={onOpen} title={`${file.name}`}>
      {((file.isImage === true) || (file.mime || "").startsWith("image/") || isImgName(file.name)) ? (<img src={file.thumbUrl || file.url} alt={file.name} className="w-full h-36 object-cover" />) : (<div className="w-full h-36 flex items-center justify-center bg-secondary text-sm text-muted-foreground font-mono font-semibold">{(file.ext || "FILE").toUpperCase()}</div>)}
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
  const [form, setForm] = useState<ProjectDetails>(project.details);
  const [newNote, setNewNote] = useState("");
  const [newContact, setNewContact] = useState({ name: "", email: "", phone: "" });
  useEffect(() => { setForm(project.details); }, [project.id, project.details]);
  const update = (k: keyof ProjectDetails, v: any) => setForm((prev) => ({ ...prev, [k]: v }));
  const save = () => {
    // Details save will be implemented later with DB
    console.log("Details save not yet implemented for DB version");
  };
  const addNote = () => {
    const t = newNote.trim();
    if (!t) return;
    const n: Note = { id: uid("n_"), text: t, ts: new Date().toISOString() };
    update("notes", [n, ...(form.notes || [])]);
    setNewNote("");
  };
  const removeNote = (id: string) => update("notes", (form.notes || []).filter((x) => x.id !== id));
  const addContact = () => {
    const c = { ...newContact, id: uid("c_") };
    if (!c.name.trim() && !c.email.trim() && !c.phone.trim()) return;
    update("contacts", [c, ...(form.contacts || [])]);
    setNewContact({ name: "", email: "", phone: "" });
  };
  const removeContact = (id: string) => update("contacts", (form.contacts || []).filter((x) => x.id !== id));

  return (
    <div className="p-6 space-y-6 overflow-auto">
      <Field label="Projektname"><input className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" value={form.projektname || ""} onChange={(e) => update("projektname", e.target.value)} /></Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Startdatum"><input type="date" className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" value={form.startdatum || ""} onChange={(e) => update("startdatum", e.target.value)} /></Field>
        <Field label="Enddatum"><input type="date" className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" value={form.enddatum || ""} onChange={(e) => update("enddatum", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Auftragsnummer"><input className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" value={form.auftragsnummer || ""} onChange={(e) => update("auftragsnummer", e.target.value)} /></Field>
        <Field label="Projektstatus"><input className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" value={form.projektstatus || ""} onChange={(e) => update("projektstatus", e.target.value)} /></Field>
      </div>

      <div className="space-y-3 pt-4">
        <div className="text-sm font-semibold text-foreground">📝 Notizen</div>
        <div className="flex gap-2 items-start">
          <textarea className="flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" rows={3} value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Neue Notiz hinzufügen…" />
          <Button onClick={addNote} disabled={!newNote.trim()}>Hinzufügen</Button>
        </div>
        <div className="space-y-2">
          {(form.notes || []).length === 0 ? (
            <div className="text-sm text-muted-foreground p-4 bg-secondary rounded-lg text-center">Keine Notizen vorhanden</div>
          ) : (
            (form.notes || []).map((n) => (
              <div key={n.id} className="flex items-start gap-3 border border-border rounded-lg p-3 bg-card">
                <div className="text-xs text-muted-foreground min-w-[140px] font-mono">{new Date(n.ts).toLocaleString("de-DE")}</div>
                <div className="flex-1 text-sm whitespace-pre-wrap">{n.text}</div>
                <button className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-accent transition-colors" onClick={() => removeNote(n.id)}>🗑️</button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-3 pt-4">
        <div className="text-sm font-semibold text-foreground">👥 Ansprechpartner</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <label className="flex flex-col gap-2 text-sm"><span className="text-muted-foreground font-medium">Name</span><input className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" value={newContact.name} onChange={(e)=>setNewContact((s)=>({...s,name:e.target.value}))} /></label>
          <label className="flex flex-col gap-2 text-sm"><span className="text-muted-foreground font-medium">E-Mail</span><input className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" value={newContact.email} onChange={(e)=>setNewContact((s)=>({...s,email:e.target.value}))} /></label>
          <label className="flex flex-col gap-2 text-sm"><span className="text-muted-foreground font-medium">Telefon</span><input className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-all" value={newContact.phone} onChange={(e)=>setNewContact((s)=>({...s,phone:e.target.value}))} /></label>
          <Button onClick={addContact}>Hinzufügen</Button>
        </div>
        <div className="space-y-2">
          {(form.contacts || []).length === 0 ? (
            <div className="text-sm text-muted-foreground p-4 bg-secondary rounded-lg text-center">Keine Ansprechpartner</div>
          ) : (
            (form.contacts || []).map((c) => (
              <div key={c.id} className="flex items-center gap-4 border border-border rounded-lg p-3 text-sm bg-card">
                <div className="font-semibold">{c.name || "–"}</div>
                <div className="text-muted-foreground">{c.email || "–"}</div>
                <div className="text-muted-foreground">{c.phone || "–"}</div>
                <button className="ml-auto text-xs px-3 py-1.5 border border-border rounded-md hover:bg-accent transition-colors" onClick={() => removeContact(c.id)}>🗑️</button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t border-border">
        <Button variant="ghost" onClick={() => setForm(project.details)}>Zurücksetzen</Button>
        <Button onClick={save}>💾 Speichern</Button>
      </div>
    </div>
  );
}

function DetailsSidebar({ project }: { project: Project }) {
  const d: ProjectDetails = project.details;
  return (
    <div className="w-full h-full overflow-auto p-6 space-y-4 text-sm">
      <div className="font-bold text-base mb-4 pb-3 border-b border-border">📋 Projektdetails</div>
      <InfoRow k="Projektname" v={d.projektname || "–"} />
      <InfoRow k="Startdatum" v={d.startdatum || "–"} />
      <InfoRow k="Enddatum" v={d.enddatum || "–"} />
      <InfoRow k="Auftragsnummer" v={d.auftragsnummer || "–"} />
      <InfoRow k="Projektstatus" v={d.projektstatus || "–"} />
      <div className="pt-4">
        <div className="text-muted-foreground font-semibold mb-2">👥 Ansprechpartner</div>
        {(d.contacts || []).length === 0 ? (
          <div className="text-muted-foreground">–</div>
        ) : (
          <div className="space-y-2">
            {(d.contacts || []).map((c) => (
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
        {(d.notes || []).length === 0 ? (
          <div className="text-muted-foreground">–</div>
        ) : (
          <div className="space-y-2">
            {(d.notes || []).map((n) => (
              <div key={n.id} className="p-2 bg-secondary rounded-md">
                <div className="text-xs text-muted-foreground font-mono mb-1">{new Date(n.ts).toLocaleString("de-DE")}</div>
                <div className="whitespace-pre-wrap text-xs">{n.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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
            <div className="text-sm font-semibold text-foreground">{r.project.title}</div>
            <div className="text-xs text-muted-foreground mt-1">📁 {r.folder.name}{r.folder.archived ? " (Archiv)" : ""}</div>
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
