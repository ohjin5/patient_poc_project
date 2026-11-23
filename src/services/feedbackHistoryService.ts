import {
  CriteriaConfig,
  CXFeedbackSheetData,
  FeedbackExecutionRecord,
  FeedbackDeliveryMethod,
  FeedbackFollowUpStatus,
} from "../types";


type PermissionStateValue =
  | "granted"
  | "denied"
  | "prompt";


interface LocalFileSystemWritableFileStream {
  write(data: string | Blob): Promise<void>;
  close(): Promise<void>;
}


interface LocalFileSystemFileHandle {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<LocalFileSystemWritableFileStream>;
}


interface LocalFileSystemDirectoryHandle {
  kind: "directory";
  name: string;

  queryPermission?(
    descriptor?: {
      mode?: "read" | "readwrite";
    }
  ): Promise<PermissionStateValue>;

  requestPermission?(
    descriptor?: {
      mode?: "read" | "readwrite";
    }
  ): Promise<PermissionStateValue>;

  getFileHandle(
    name: string,
    options?: {
      create?: boolean;
    }
  ): Promise<LocalFileSystemFileHandle>;

  getDirectoryHandle(
    name: string,
    options?: {
      create?: boolean;
    }
  ): Promise<LocalFileSystemDirectoryHandle>;

  values(): AsyncIterableIterator<
    LocalFileSystemFileHandle | LocalFileSystemDirectoryHandle
  >;
}


interface WindowWithDirectoryPicker extends Window {
  showDirectoryPicker?(
    options?: {
      mode?: "read" | "readwrite";
      startIn?: string;
    }
  ): Promise<LocalFileSystemDirectoryHandle>;
}


export type FeedbackHistoryStatus =
  | "DRAFT"
  | "FINALIZED"
  | "DELIVERED"
  | "FOLLOW_UP";


export interface FeedbackHistoryIndexItem {
  id: string;
  fileName: string;
  relativePath: string;
  period: string;
  departmentId: string;
  departmentName: string;
  peerGroup: string;
  peerGroupLabel: string;
  overallScore: number;
  priority: string;
  status: FeedbackHistoryStatus;
  generatedAt: string;
  savedAt: string;
  updatedAt: string;
}


export interface FeedbackHistoryIndexFile {
  schemaVersion: 1;
  updatedAt: string;
  items: FeedbackHistoryIndexItem[];
}


export interface FeedbackHistoryRecord {
  schemaVersion: 1;
  id: string;
  savedAt: string;
  updatedAt: string;
  historyStatus: FeedbackHistoryStatus;
  period: string;
  departmentKey: string;
  departmentId: string;
  departmentName: string;
  peerGroup: string;
  peerGroupLabel: string;
  criteriaSnapshot?: CriteriaConfig;
  feedbackSheet: CXFeedbackSheetData;
}


export interface SaveFeedbackHistoryInput {
  sheetData: CXFeedbackSheetData;
  criteriaSnapshot?: CriteriaConfig;
  historyStatus?: FeedbackHistoryStatus;
}


export interface FeedbackHistoryLoadResult {
  records: FeedbackHistoryRecord[];
  skippedFiles: string[];
}


export interface SaveFeedbackExecutionInput {
  id?: string;
  feedbackHistoryId: string;
  departmentId: string;
  departmentName: string;
  period: string;
  feedbackDate: string;
  method: FeedbackDeliveryMethod;
  methodDetail?: string;
  recipient?: string;
  feedbackText: string;
  followUpStatus: FeedbackFollowUpStatus;
  followUpMemo?: string;
  nextFollowUpDate?: string;
  hasLinkedReport?: boolean;
}


interface FeedbackExecutionStoreFile {
  schemaVersion: 1;
  updatedAt: string;
  items: FeedbackExecutionRecord[];
}


export type RememberedFolderRestoreStatus =
  | "NONE"
  | "RESTORED"
  | "PERMISSION_REQUIRED"
  | "FAILED";


class FeedbackHistoryService {
  private directoryHandle: LocalFileSystemDirectoryHandle | null = null;

  private readonly handleDbName = "todays-px-history";
  private readonly handleStoreName = "directory-handles";
  private readonly handleKey = "feedback-history-root";


  public isSupported(): boolean {
    if (typeof window === "undefined") {
      return false;
    }

    const browserWindow = window as WindowWithDirectoryPicker;
    return Boolean(browserWindow.showDirectoryPicker);
  }


  public isConnected(): boolean {
    return Boolean(this.directoryHandle);
  }


  public getConnectedFolderName(): string {
    return this.directoryHandle?.name || "";
  }


  public async connectHistoryFolder(): Promise<string> {
    if (!this.isSupported()) {
      throw new Error("FILE_SYSTEM_ACCESS_NOT_SUPPORTED");
    }

    const browserWindow = window as WindowWithDirectoryPicker;

    const handle = await browserWindow.showDirectoryPicker!({
      mode: "readwrite",
    });

    const granted = await this.ensurePermission(handle, true);

    if (!granted) {
      throw new Error("HISTORY_FOLDER_PERMISSION_DENIED");
    }

    this.directoryHandle = handle;
    await this.persistDirectoryHandle(handle);
    await this.ensureIndexFile();

    return handle.name;
  }


  public disconnectHistoryFolder(): void {
    this.directoryHandle = null;
  }


  public async forgetRememberedFolder(): Promise<void> {
    this.directoryHandle = null;
    await this.deletePersistedDirectoryHandle();
  }


  public async restoreRememberedFolder(): Promise<RememberedFolderRestoreStatus> {
    if (typeof window === "undefined" || typeof indexedDB === "undefined") {
      return "NONE";
    }

    try {
      const handle = await this.readPersistedDirectoryHandle();
      if (!handle) {
        return "NONE";
      }

      this.directoryHandle = handle;
      const state = await this.queryPermissionState(handle);

      if (state === "granted") {
        await this.ensureIndexFile();
        return "RESTORED";
      }

      return "PERMISSION_REQUIRED";
    } catch (error) {
      console.warn(
        "[FeedbackHistory] 저장된 폴더 핸들 복원 실패:",
        error instanceof Error ? error.message : error
      );
      this.directoryHandle = null;
      return "FAILED";
    }
  }


  public async ensureConnectedPermission(
    requestIfNeeded: boolean = true
  ): Promise<boolean> {
    if (!this.directoryHandle) {
      return false;
    }

    return this.ensurePermission(this.directoryHandle, requestIfNeeded);
  }


  private async ensurePermission(
    handle: LocalFileSystemDirectoryHandle,
    requestIfNeeded: boolean = true
  ): Promise<boolean> {
    try {
      const current = await this.queryPermissionState(handle);

      if (current === "granted") {
        return true;
      }

      if (!requestIfNeeded) {
        return false;
      }

      if (handle.requestPermission) {
        const requested = await handle.requestPermission({
          mode: "readwrite",
        });

        return requested === "granted";
      }

      return true;
    } catch (error) {
      console.error(
        "[FeedbackHistory] 폴더 권한 확인 실패:",
        error instanceof Error ? error.message : error
      );

      return false;
    }
  }


  private async queryPermissionState(
    handle: LocalFileSystemDirectoryHandle
  ): Promise<PermissionStateValue> {
    if (handle.queryPermission) {
      return handle.queryPermission({ mode: "readwrite" });
    }

    return "granted";
  }


  private openHandleDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.handleDbName, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.handleStoreName)) {
          db.createObjectStore(this.handleStoreName);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("INDEXEDDB_OPEN_FAILED"));
    });
  }


  private async persistDirectoryHandle(
    handle: LocalFileSystemDirectoryHandle
  ): Promise<void> {
    if (typeof indexedDB === "undefined") {
      return;
    }

    const db = await this.openHandleDb();

    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(this.handleStoreName, "readwrite");
        tx.objectStore(this.handleStoreName).put(handle, this.handleKey);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error("INDEXEDDB_WRITE_FAILED"));
        tx.onabort = () => reject(tx.error || new Error("INDEXEDDB_WRITE_ABORTED"));
      });
    } finally {
      db.close();
    }
  }


  private async readPersistedDirectoryHandle(): Promise<LocalFileSystemDirectoryHandle | null> {
    if (typeof indexedDB === "undefined") {
      return null;
    }

    const db = await this.openHandleDb();

    try {
      return await new Promise<LocalFileSystemDirectoryHandle | null>((resolve, reject) => {
        const tx = db.transaction(this.handleStoreName, "readonly");
        const request = tx.objectStore(this.handleStoreName).get(this.handleKey);
        request.onsuccess = () => resolve((request.result as LocalFileSystemDirectoryHandle | undefined) || null);
        request.onerror = () => reject(request.error || new Error("INDEXEDDB_READ_FAILED"));
      });
    } finally {
      db.close();
    }
  }


  private async deletePersistedDirectoryHandle(): Promise<void> {
    if (typeof indexedDB === "undefined") {
      return;
    }

    const db = await this.openHandleDb();

    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(this.handleStoreName, "readwrite");
        tx.objectStore(this.handleStoreName).delete(this.handleKey);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error("INDEXEDDB_DELETE_FAILED"));
      });
    } finally {
      db.close();
    }
  }


  public async saveFeedbackHistory(
    input: SaveFeedbackHistoryInput
  ): Promise<FeedbackHistoryRecord> {
    const root = await this.requireConnectedDirectory();
    const now = new Date().toISOString();

    const sanitizedSheet = this.sanitizeFeedbackSheet(input.sheetData);
    const departmentKey = this.buildDepartmentKey(sanitizedSheet);
    const id = this.buildHistoryId(sanitizedSheet, now);

    const record: FeedbackHistoryRecord = {
      schemaVersion: 1,
      id,
      savedAt: now,
      updatedAt: now,
      historyStatus: input.historyStatus || "DRAFT",
      period: sanitizedSheet.period || "",
      departmentKey,
      departmentId: sanitizedSheet.departmentId,
      departmentName: sanitizedSheet.departmentName,
      peerGroup: sanitizedSheet.peerGroup || "",
      peerGroupLabel: sanitizedSheet.peerGroupLabel || "",
      criteriaSnapshot: input.criteriaSnapshot
        ? this.deepClone(input.criteriaSnapshot)
        : undefined,
      feedbackSheet: sanitizedSheet,
    };

    const periodFolderName = this.sanitizeFileName(
      sanitizedSheet.period || "기간미확인"
    );

    const periodFolder = await root.getDirectoryHandle(
      periodFolderName,
      { create: true }
    );

    const fileName = this.buildRecordFileName(record);

    await this.writeJsonFile(
      periodFolder,
      fileName,
      record
    );

    const index = await this.readIndex();

    const newIndexItem = this.toIndexItem(
      record,
      fileName,
      `${periodFolderName}/${fileName}`
    );

    const mergedItems = [
      newIndexItem,
      ...index.items.filter((item) => item.id !== record.id),
    ];

    const updatedIndex: FeedbackHistoryIndexFile = {
      schemaVersion: 1,
      updatedAt: now,
      items: mergedItems.sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt)
      ),
    };

    await this.writeJsonFile(
      root,
      "history-index.json",
      updatedIndex
    );

    return record;
  }


  public async loadAllHistory(): Promise<FeedbackHistoryLoadResult> {
    const root =
      await this.requireConnectedDirectory();

    const recordMap =
      new Map<
        string,
        FeedbackHistoryRecord
      >();

    const skippedFiles =
      new Set<string>();


    const addRecord =
      (
        record:
          FeedbackHistoryRecord
      ) => {

        const existing =
          recordMap.get(
            record.id
          );


        if (
          !existing ||
          String(
            record.updatedAt ||
            record.savedAt ||
            ""
          ).localeCompare(
            String(
              existing.updatedAt ||
              existing.savedAt ||
              ""
            )
          ) >= 0
        ) {

          recordMap.set(
            record.id,
            record
          );
        }
      };


    const readHistoryHandle =
      async (
        handle:
          LocalFileSystemFileHandle,
        displayPath:
          string
      ): Promise<boolean> => {

        try {

          const parsed =
            await this.readJsonFile<
              unknown
            >(
              handle
            );


          if (
            !this.isFeedbackHistoryRecord(
              parsed
            )
          ) {

            skippedFiles.add(
              `${displayPath} (이력 형식 아님)`
            );

            return false;
          }


          addRecord(
            parsed
          );

          return true;

        } catch (
          error
        ) {

          console.warn(
            "[FeedbackHistory] Report JSON 읽기 실패:",
            displayPath,
            error instanceof Error
              ? error.message
              : error
          );


          skippedFiles.add(
            `${displayPath} (읽기 실패)`
          );

          return false;
        }
      };


    /**
     * ========================================================
     * 1. history-index.json 우선 사용
     * ========================================================
     *
     * 폴더 전체를 재귀 탐색하지 않습니다.
     * 대용량/상위 폴더를 실수로 선택했을 때 브라우저가
     * 멈추는 문제를 피하기 위한 방식입니다.
     */
    let index:
      FeedbackHistoryIndexFile =
      this.createEmptyIndex();


    try {

      index =
        await this.readIndex();

    } catch (
      error
    ) {

      console.warn(
        "[FeedbackHistory] index 조회 실패:",
        error instanceof Error
          ? error.message
          : error
      );
    }


    for (
      const item of
      index.items
    ) {

      let loaded =
        false;


      /**
       * A) index에 저장된 상대경로
       */
      if (
        item.relativePath
      ) {

        try {

          const handle =
            await this.getFileHandleByRelativePath(
              root,
              item.relativePath
            );


          loaded =
            await readHistoryHandle(
              handle,
              item.relativePath
            );

        } catch {
          // 아래 호환 경로를 계속 시도합니다.
        }
      }


      /**
       * B) 과거 버전 호환:
       * 선택 폴더 바로 아래에 JSON이 저장된 경우
       */
      if (
        !loaded &&
        item.fileName
      ) {

        try {

          const rootHandle =
            await root.getFileHandle(
              item.fileName
            );


          loaded =
            await readHistoryHandle(
              rootHandle,
              item.fileName
            );

        } catch {
          // 다음 경로를 계속 시도합니다.
        }
      }


      /**
       * C) 현재 버전 호환:
       * 선택폴더/<기간>/<파일명>
       */
      if (
        !loaded &&
        item.fileName
      ) {

        try {

          const periodFolderName =
            this.sanitizeFileName(
              item.period ||
              "기간미확인"
            );


          const periodFolder =
            await root.getDirectoryHandle(
              periodFolderName
            );


          const periodHandle =
            await periodFolder.getFileHandle(
              item.fileName
            );


          loaded =
            await readHistoryHandle(
              periodHandle,
              `${periodFolderName}/${item.fileName}`
            );

        } catch {
          // 최종 실패 처리
        }
      }


      if (
        !loaded
      ) {

        skippedFiles.add(
          item.relativePath ||
          item.fileName ||
          item.id
        );
      }
    }


    /**
     * ========================================================
     * 2. index가 비어 있는 과거 폴더에 대한 제한적 보조 탐색
     * ========================================================
     *
     * 재귀 탐색은 하지 않고 "현재 폴더 1단계"만 확인합니다.
     * FileSystemDirectoryHandle.values()를 지원하지 않는 브라우저에서는
     * 이 단계가 조용히 건너뛰어집니다.
     */
    if (
      index.items.length ===
      0
    ) {

      try {

        if (
          typeof root.values ===
          "function"
        ) {

          for await (
            const entry of
              root.values()
          ) {

            if (
              entry.kind ===
              "file"
            ) {

              const lowerName =
                entry.name
                  .toLowerCase();


              if (
                lowerName.endsWith(
                  ".json"
                ) &&
                lowerName !==
                  "history-index.json" &&
                lowerName !==
                  "feedback-management.json"
              ) {

                await readHistoryHandle(
                  entry as
                    LocalFileSystemFileHandle,
                  entry.name
                );
              }


              continue;
            }


            /**
             * 하위 폴더도 딱 1단계만 확인합니다.
             */
            const childFolder =
              entry as
                LocalFileSystemDirectoryHandle;


            if (
              typeof childFolder.values !==
              "function"
            ) {
              continue;
            }


            for await (
              const child of
                childFolder.values()
            ) {

              if (
                child.kind !==
                "file"
              ) {
                continue;
              }


              const lowerChildName =
                child.name
                  .toLowerCase();


              if (
                !lowerChildName.endsWith(
                  ".json"
                ) ||
                lowerChildName ===
                  "history-index.json" ||
                lowerChildName ===
                  "feedback-management.json"
              ) {
                continue;
              }


              await readHistoryHandle(
                child as
                  LocalFileSystemFileHandle,
                `${childFolder.name}/${child.name}`
              );
            }
          }
        }

      } catch (
        error
      ) {

        console.warn(
          "[FeedbackHistory] 제한적 폴더 스캔 실패:",
          error instanceof Error
            ? error.message
            : error
        );
      }
    }


    const records =
      Array.from(
        recordMap.values()
      ).sort(
        (
          a,
          b
        ) =>
          String(
            b.updatedAt ||
            b.savedAt ||
            ""
          ).localeCompare(
            String(
              a.updatedAt ||
              a.savedAt ||
              ""
            )
          )
      );


    console.info(
      `[FeedbackHistory] 조회 완료 | index=${index.items.length}건 | report=${records.length}건 | skipped=${skippedFiles.size}건 | folder=${root.name}`
    );


    return {
      records,

      skippedFiles:
        Array.from(
          skippedFiles
        ),
    };
  }


  private async getFileHandleByRelativePath(
    root:
      LocalFileSystemDirectoryHandle,
    relativePath:
      string
  ): Promise<LocalFileSystemFileHandle> {

    const segments =
      String(
        relativePath ||
        ""
      )
        .replace(
          /\\/g,
          "/"
        )
        .split(
          "/"
        )
        .map(
          (
            segment
          ) =>
            segment.trim()
        )
        .filter(
          Boolean
        );


    if (
      segments.length ===
      0
    ) {
      throw new Error(
        "EMPTY_HISTORY_RELATIVE_PATH"
      );
    }


    const fileName =
      segments.pop()!;


    let directory =
      root;


    for (
      const folderName of
      segments
    ) {

      directory =
        await directory
          .getDirectoryHandle(
            folderName
          );
    }


    return directory
      .getFileHandle(
        fileName
      );
  }


  public async readIndex(): Promise<FeedbackHistoryIndexFile> {
    const root = await this.requireConnectedDirectory();

    try {
      const fileHandle = await root.getFileHandle(
        "history-index.json"
      );

      const parsed = await this.readJsonFile<unknown>(fileHandle);

      if (this.isHistoryIndexFile(parsed)) {
        return parsed;
      }

      throw new Error("INVALID_HISTORY_INDEX");
    } catch (error) {
      console.warn(
        "[FeedbackHistory] history-index.json 읽기 실패, 빈 인덱스로 대체:",
        error instanceof Error ? error.message : error
      );

      return this.createEmptyIndex();
    }
  }


  public async rebuildIndexFromFiles(): Promise<FeedbackHistoryIndexFile> {
    const root = await this.requireConnectedDirectory();
    const loaded = await this.loadAllHistory();

    const items = loaded.records.map((record) => {
      const periodFolderName = this.sanitizeFileName(
        record.period || "기간미확인"
      );

      const fileName = this.buildRecordFileName(record);

      return this.toIndexItem(
        record,
        fileName,
        `${periodFolderName}/${fileName}`
      );
    });

    const rebuilt: FeedbackHistoryIndexFile = {
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      items: items.sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt)
      ),
    };

    await this.writeJsonFile(
      root,
      "history-index.json",
      rebuilt
    );

    return rebuilt;
  }


  public async loadFeedbackExecutions(): Promise<FeedbackExecutionRecord[]> {
    const root = await this.requireConnectedDirectory();

    try {
      const handle = await root.getFileHandle(
        "feedback-management.json"
      );

      const parsed = await this.readJsonFile<unknown>(
        handle
      );

      if (!this.isFeedbackExecutionStoreFile(parsed)) {
        throw new Error(
          "INVALID_FEEDBACK_MANAGEMENT_FILE"
        );
      }

      return [...parsed.items].sort(
        (a, b) =>
          (b.feedbackDate || b.updatedAt).localeCompare(
            a.feedbackDate || a.updatedAt
          )
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "";

      if (
        message ===
        "INVALID_FEEDBACK_MANAGEMENT_FILE"
      ) {
        throw error;
      }

      const emptyStore: FeedbackExecutionStoreFile = {
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        items: [],
      };

      await this.writeJsonFile(
        root,
        "feedback-management.json",
        emptyStore
      );

      return [];
    }
  }


  public async saveFeedbackExecution(
    input: SaveFeedbackExecutionInput
  ): Promise<FeedbackExecutionRecord> {
    const root = await this.requireConnectedDirectory();

    const now =
      new Date().toISOString();

    const currentItems =
      await this.loadFeedbackExecutions();

    const existing =
      input.id
        ? currentItems.find(
            (item) =>
              item.id === input.id
          )
        : undefined;

    const id =
      existing?.id ||
      this.buildFeedbackExecutionId(
        input,
        now
      );

    const record: FeedbackExecutionRecord = {
      id,
      feedbackHistoryId:
        input.feedbackHistoryId,
      departmentId:
        input.departmentId,
      departmentName:
        input.departmentName,
      period:
        input.period,
      feedbackDate:
        input.feedbackDate,
      method:
        input.method,
      methodDetail:
        this.cleanOptionalText(
          input.methodDetail
        ),
      recipient:
        this.cleanOptionalText(
          input.recipient
        ),
      feedbackText:
        String(
          input.feedbackText || ""
        ).trim(),
      followUpStatus:
        input.followUpStatus,
      followUpMemo:
        this.cleanOptionalText(
          input.followUpMemo
        ),
      nextFollowUpDate:
        this.cleanOptionalText(
          input.nextFollowUpDate
        ),
      hasLinkedReport:
        input.hasLinkedReport !== false,
      createdAt:
        existing?.createdAt ||
        now,
      updatedAt:
        now,
    };

    const nextItems = [
      record,
      ...currentItems.filter(
        (item) =>
          item.id !== id
      ),
    ];

    const store: FeedbackExecutionStoreFile = {
      schemaVersion: 1,
      updatedAt:
        now,
      items:
        nextItems,
    };

    await this.writeJsonFile(
      root,
      "feedback-management.json",
      store
    );

    return record;
  }


  public async deleteFeedbackExecution(
    id: string
  ): Promise<void> {
    const root = await this.requireConnectedDirectory();

    const currentItems =
      await this.loadFeedbackExecutions();

    const store: FeedbackExecutionStoreFile = {
      schemaVersion: 1,
      updatedAt:
        new Date().toISOString(),
      items:
        currentItems.filter(
          (item) =>
            item.id !== id
        ),
    };

    await this.writeJsonFile(
      root,
      "feedback-management.json",
      store
    );
  }


  private buildFeedbackExecutionId(
    input: SaveFeedbackExecutionInput,
    timestamp: string
  ): string {
    return this.sanitizeFileName(
      [
        "feedback",
        input.departmentId ||
          input.departmentName ||
          "unit",
        input.feedbackDate ||
          "date",
        timestamp,
      ].join("-")
    );
  }


  private cleanOptionalText(
    value?: string
  ): string | undefined {
    const cleaned =
      String(
        value || ""
      ).trim();

    return cleaned ||
      undefined;
  }


  private isFeedbackExecutionStoreFile(
    value: unknown
  ): value is FeedbackExecutionStoreFile {
    if (
      !value ||
      typeof value !== "object"
    ) {
      return false;
    }

    const candidate =
      value as Partial<FeedbackExecutionStoreFile>;

    return (
      candidate.schemaVersion === 1 &&
      Array.isArray(candidate.items)
    );
  }


  private async requireConnectedDirectory(): Promise<LocalFileSystemDirectoryHandle> {
    if (!this.directoryHandle) {
      throw new Error("HISTORY_FOLDER_NOT_CONNECTED");
    }

    /**
     * 일반 조회/저장 과정에서 requestPermission()을 반복 호출하지 않습니다.
     * 브라우저가 권한을 prompt 상태로 돌린 경우,
     * 화면의 명시적인 "다시 연결" 버튼에서만 권한을 요청합니다.
     */
    const granted = await this.ensurePermission(
      this.directoryHandle,
      false
    );

    if (!granted) {
      throw new Error("HISTORY_FOLDER_PERMISSION_REQUIRED");
    }

    return this.directoryHandle;
  }


  private async ensureIndexFile(): Promise<void> {
    const root = await this.requireConnectedDirectory();

    try {
      const fileHandle = await root.getFileHandle(
        "history-index.json"
      );

      const parsed = await this.readJsonFile<unknown>(fileHandle);

      if (this.isHistoryIndexFile(parsed)) {
        return;
      }
    } catch {
      // 없거나 손상된 경우 아래에서 새로 생성합니다.
    }

    await this.writeJsonFile(
      root,
      "history-index.json",
      this.createEmptyIndex()
    );
  }


  private createEmptyIndex(): FeedbackHistoryIndexFile {
    return {
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      items: [],
    };
  }


  private async writeJsonFile(
    directory: LocalFileSystemDirectoryHandle,
    fileName: string,
    data: unknown
  ): Promise<void> {
    const fileHandle = await directory.getFileHandle(
      fileName,
      { create: true }
    );

    const writable = await fileHandle.createWritable();
    const json = JSON.stringify(data, null, 2);

    await writable.write(json);
    await writable.close();
  }


  private async readJsonFile<T>(
    fileHandle: LocalFileSystemFileHandle
  ): Promise<T> {
    const file = await fileHandle.getFile();
    const text = await file.text();

    return JSON.parse(text) as T;
  }


  private sanitizeFeedbackSheet(
    sheet: CXFeedbackSheetData
  ): CXFeedbackSheetData {
    const cloned = this.deepClone(sheet);

    cloned.relatedVocItems = (
      cloned.relatedVocItems || []
    ).map((voc) => ({
      id: String(voc.id || ""),
      date: String(voc.date || ""),
      sentiment: voc.sentiment,
      recommendationScore:
        typeof voc.recommendationScore === "number"
          ? voc.recommendationScore
          : undefined,
      category: voc.category,
      content: String(voc.content || ""),
      division: voc.division
        ? String(voc.division)
        : undefined,
      center: voc.center
        ? String(voc.center)
        : undefined,
      department: voc.department
        ? String(voc.department)
        : undefined,
      doctor: voc.doctor
        ? String(voc.doctor)
        : undefined,
      ward: voc.ward
        ? String(voc.ward)
        : undefined,
      examRoom: voc.examRoom
        ? String(voc.examRoom)
        : undefined,
    }));

    return cloned;
  }


  private buildDepartmentKey(
    sheet: CXFeedbackSheetData
  ): string {
    return [
      sheet.peerGroup || "UNKNOWN",
      sheet.parentDepartment || "",
      sheet.departmentName || sheet.departmentId,
    ]
      .map((value) => this.normalizeKey(value))
      .join("::");
  }


  private buildHistoryId(
    sheet: CXFeedbackSheetData,
    timestamp: string
  ): string {
    const base = [
      sheet.period || "period",
      sheet.peerGroup || "UNKNOWN",
      sheet.departmentId || sheet.departmentName || "unit",
      timestamp,
    ].join("-");

    return this.sanitizeFileName(base);
  }


  private buildRecordFileName(
    record: FeedbackHistoryRecord
  ): string {
    const compactPeriod =
      (record.period || "기간미확인")
        .replace(/[^0-9]/g, "") ||
      "unknown";

    const peerGroup = this.sanitizeFileName(
      record.peerGroup || "UNKNOWN"
    );

    const departmentName = this.sanitizeFileName(
      record.departmentName || record.departmentId || "unit"
    );

    const compactId = this.sanitizeFileName(record.id).slice(-24);

    return [
      peerGroup,
      departmentName,
      compactPeriod,
      compactId,
    ]
      .filter(Boolean)
      .join("_") + ".json";
  }


  private toIndexItem(
    record: FeedbackHistoryRecord,
    fileName: string,
    relativePath: string
  ): FeedbackHistoryIndexItem {
    return {
      id: record.id,
      fileName,
      relativePath,
      period: record.period,
      departmentId: record.departmentId,
      departmentName: record.departmentName,
      peerGroup: record.peerGroup,
      peerGroupLabel: record.peerGroupLabel,
      overallScore: record.feedbackSheet.overallScore,
      priority: record.feedbackSheet.priority,
      status: record.historyStatus,
      generatedAt: record.feedbackSheet.generatedAt,
      savedAt: record.savedAt,
      updatedAt: record.updatedAt,
    };
  }


  private isHistoryIndexFile(
    value: unknown
  ): value is FeedbackHistoryIndexFile {
    if (!value || typeof value !== "object") {
      return false;
    }

    const candidate = value as Partial<FeedbackHistoryIndexFile>;

    return (
      candidate.schemaVersion === 1 &&
      Array.isArray(candidate.items)
    );
  }


  private isFeedbackHistoryRecord(
    value: unknown
  ): value is FeedbackHistoryRecord {
    if (!value || typeof value !== "object") {
      return false;
    }

    const candidate = value as Partial<FeedbackHistoryRecord>;

    if (candidate.schemaVersion !== 1) {
      return false;
    }

    if (
      typeof candidate.id !== "string" ||
      typeof candidate.period !== "string" ||
      typeof candidate.departmentId !== "string" ||
      typeof candidate.departmentName !== "string"
    ) {
      return false;
    }

    if (
      !candidate.feedbackSheet ||
      typeof candidate.feedbackSheet !== "object"
    ) {
      return false;
    }

    return true;
  }


  private sanitizeFileName(value: string): string {
    const cleaned = String(value || "")
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^\.+/, "")
      .replace(/\.+$/, "");

    return (cleaned || "untitled").slice(0, 120);
  }


  private normalizeKey(value: string): string {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[(){}\[\]\-_]/g, "");
  }


  private deepClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}


export const feedbackHistoryService =
  new FeedbackHistoryService();
