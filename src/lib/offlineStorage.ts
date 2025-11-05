import localforage from 'localforage';

// IndexedDB Stores
const foldersStore = localforage.createInstance({ name: 'folders' });
const projectsStore = localforage.createInstance({ name: 'projects' });
const messagesStore = localforage.createInstance({ name: 'messages' });
const filesStore = localforage.createInstance({ name: 'files' });
const syncQueueStore = localforage.createInstance({ name: 'sync_queue' });

export const offlineStorage = {
  // Folders
  async getFolders() {
    return await foldersStore.getItem<any[]>('all') || [];
  },
  async setFolders(folders: any[]) {
    await foldersStore.setItem('all', folders);
  },
  
  // Projects
  async getProjects() {
    return await projectsStore.getItem<any[]>('all') || [];
  },
  async setProjects(projects: any[]) {
    await projectsStore.setItem('all', projects);
  },
  
  // Messages
  async getMessages(projectId: string) {
    return await messagesStore.getItem<any[]>(projectId) || [];
  },
  async setMessages(projectId: string, messages: any[]) {
    await messagesStore.setItem(projectId, messages);
  },
  
  // Files
  async getFiles(projectId: string) {
    return await filesStore.getItem<any[]>(projectId) || [];
  },
  async setFiles(projectId: string, files: any[]) {
    await filesStore.setItem(projectId, files);
  },
  
  // Sync Queue
  async getSyncQueue() {
    return await syncQueueStore.getItem<any[]>('queue') || [];
  },
  async addToSyncQueue(item: any) {
    const queue = await this.getSyncQueue();
    queue.push(item);
    await syncQueueStore.setItem('queue', queue);
  },
  async clearSyncQueue() {
    await syncQueueStore.setItem('queue', []);
  },
  async removeFromSyncQueue(id: string) {
    const queue = await this.getSyncQueue();
    const filtered = queue.filter((item: any) => item.id !== id);
    await syncQueueStore.setItem('queue', filtered);
  },
};
