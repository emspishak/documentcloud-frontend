import { Svue } from "svue";
import {
  getDocuments,
  getDocumentsWithIds,
  deleteDocument,
  reprocessDocument,
  changeAccess,
  renameDocument,
  PENDING,
  addData,
  removeData,
} from "@/api/document";
import {
  addDocumentsToProject,
  removeDocumentsFromProject,
} from "@/api/project";
import { layout, hideAccess } from "./layout";
import { wrapLoad, wrapSeparate } from "@/util/wrapLoad";
import { showConfirm } from "./confirmDialog";
import { router } from "@/router/router";
import { search, handleUpload, setDocuments } from "@/search/search";
import { pushToast } from "./toast";
import { handlePlural } from "@/util/string";
import { removeFromArray, addToArrayIfUnique } from "@/util/array";
import { modifications } from './modifications';
import { docEquals, copyDoc } from '@/structure/document';

let lastSelected = null;

export const documents = new Svue({
  data() {
    return {
      processingDocumentsRaw: [],
      router,
      search,
    };
  },
  watch: {
    "router.resolvedRoute"() {
      const route = router.resolvedRoute;
      unselectAll();
      if (route != null && route.name == "app" && route.props.q != null) {
        initDocuments();
      } else {
        this.processingDocumentsRaw = [];
      }
    },
  },
  computed: {
    documents(search) {
      return search.documents;
    },
    error(search) {
      return search.error;
    },
    allDocuments(documents, processingDocumentsRaw) {
      const processingExclusive = processingDocumentsRaw.filter(
        (doc) => !documentsInclude(documents, doc.id)
      );
      return [...documents, ...processingExclusive];
    },
    processingDocuments(processingDocumentsRaw, documents) {
      return getDocumentsByCondition(
        (doc) => doc.pending,
        processingDocumentsRaw,
        documents
      );
    },
    updatingDocuments(processingDocumentsRaw, documents) {
      return getDocumentsByCondition(
        (doc) => doc.readable,
        processingDocumentsRaw,
        documents
      );
    },
    numProcessing(processingDocuments) {
      return processingDocuments.length;
    },
    doneProcessing(processingDocuments) {
      return processingDocuments.length == 0;
    },
    processingProgress(processingDocuments) {
      if (processingDocuments.length == 0) return 1;

      // Operate on documents with non-null progresses
      const pDocs = processingDocuments.filter((d) => d.realProgress != null);
      if (pDocs.length == 0) return null;
      let sum = 0;
      pDocs.forEach((doc) => (sum += doc.realProgress));
      return sum / pDocs.length;
    },
    pollDocuments(processingDocuments, updatingDocuments) {
      return [...processingDocuments, ...updatingDocuments];
    },
    pollEvents(pollDocuments) {
      if (pollDocuments.length == 0) return [];
      return [
        async () => {
          const newDocs = await getDocumentsWithIds(
            pollDocuments.map((doc) => doc.id),
            true
          );
          newDocs.forEach((doc) => replaceInCollection(doc));
        },
      ];
    },
  },
});

function getDocumentsByCondition(condition, processingDocumentsRaw, documents) {
  const docsFromProcessing = processingDocumentsRaw.filter((doc) =>
    condition(doc)
  );
  const docsFromPrimary = documents.filter(
    (doc) => condition(doc) && !documentsInclude(docsFromProcessing, doc.id)
  );
  return [...docsFromProcessing, ...docsFromPrimary];
}

function documentsInclude(documents, id) {
  for (let i = 0; i < documents.length; i++) {
    if (documents[i].id == id) return true;
  }
  return false;
}

const collectionModifiers = {
  addToCollection,
  removeFromCollection,
  updateInCollection,
};

function removeFromCollection(document, modify = true) {
  if (modify) {
    // Track the modifications
    modifications.remove(collectionModifiers, copyDoc(document));
  }

  const newDocuments = documents.documents.filter(
    (doc) => doc.id != document.id
  );
  const newProcessingDocuments = documents.processingDocumentsRaw.filter(
    (doc) => doc.id != document.id
  );
  setDocuments(newDocuments);
  documents.processingDocumentsRaw = newProcessingDocuments;

  // Refresh when you delete everything to pull new search
  if (newDocuments.length == 0) window.location.reload();
}

export function updateInCollection(document, docFn, modify = true) {
  const oldDoc = copyDoc(document);
  const newDoc = copyDoc(document);
  docFn(newDoc);

  if (modify) {
    // Track the modifications
    if (!docEquals(oldDoc, newDoc)) {
      // Only track modifications if an actual update occurs
      modifications.modify(collectionModifiers, oldDoc, docFn);
    }
  }

  let modified = false;
  const newDocuments = documents.documents.map((doc) => {
    if (doc.id == document.id) {
      docFn(doc);
      modified = true;
    }
    return doc;
  });
  const newProcessingDocuments = documents.processingDocumentsRaw.map((doc) => {
    if (doc.id == document.id) {
      docFn(doc);
      modified = true;
    }
    return doc;
  });

  documents.processingDocumentsRaw = newProcessingDocuments;
  setDocuments(newDocuments);
  return [modified, newDoc];
}

function replaceInCollection(document) {
  updateInCollection(document, (doc) => {
    doc.doc = document.doc;
  });
}

function addToCollection(newDocs, modify = true) {
  if (modify) {
    // Track the modifications
    modifications.add(collectionModifiers, newDocs.map(x => copyDoc(x)));
  }

  const remainingDocs = [];
  newDocs.forEach((newDoc) => {
    if (documentsInclude(documents.allDocuments, newDoc.id)) {
      replaceInCollection(newDoc);
    } else {
      remainingDocs.push(newDoc);
    }
  });

  handleUpload(remainingDocs);
}

export function getIndex(document) {
  for (let i = 0; i < documents.documents.length; i++) {
    if (documents.documents[i] == document) return i;
  }
  return null;
}

export function removeDocuments(documents) {
  if (documents.length == 0) return;
  showConfirm(
    "Confirm delete",
    `Proceeding will permanently delete the ${documents.length == 1
      ? "selected document"
      : `${documents.length} selected documents`
    }. Do you wish to continue?`,
    "Delete",
    async () => {
      await wrapLoad(layout, async () => {
        await deleteDocument(documents.map((doc) => doc.id));
        documents.map((doc) => removeFromCollection(doc));
      });
      unselectAll();
    }
  );
}

export function reprocessDocuments(documents) {
  if (documents.length == 0) return;
  showConfirm(
    "Confirm reprocess",
    `Proceeding will force the ${documents.length == 1
      ? "selected document"
      : `${documents.length} selected documents`
    } to reprocess page and image text. Do you wish to continue?`,
    "Reprocess",
    async () => {
      await wrapLoad(layout, async () => {
        const ids = documents.map((doc) => doc.id);
        await reprocessDocument(ids);
        const reprocessingDocs = await getDocumentsWithIds(ids, true);
        reprocessingDocs.map((doc) => replaceInCollection(doc));
      });
      unselectAll();
    }
  );
}

export async function changeAccessForDocuments(documents, access) {
  await wrapLoad(layout, async () => {
    await changeAccess(
      documents.map((doc) => doc.id),
      access
    );
    documents.forEach((doc) =>
      updateInCollection(doc, (d) => (d.doc = { ...d.doc, status: "readable" }))
    );
  });
  hideAccess();
}

export function removeDocument(document) {
  return removeDocuments([document]);
}

export async function renameSelectedDocuments(title) {
  await wrapLoad(layout, async () => {
    await renameDocument(
      layout.selected.map((doc) => doc.id),
      title
    );
    // Show changes in UI
    layout.selected.forEach((doc) =>
      updateInCollection(doc, (d) => (d.doc = { ...d.doc, title }))
    );
  });
  unselectAll();
}

export async function addDocumentData(documents, key, value) {
  for (let i = 0; i < documents.length; i++) {
    const document = documents[i];
    // TODO: replace with bulk method
    await addData(document.id, key, value);

    if (document.doc.data[key] == null) {
      document.doc.data[key] = [value];
    } else {
      document.doc.data[key].push(value);
    }
    // Trigger document data update
    document.doc = document.doc;
    replaceInCollection(document);
  }
}

export async function replaceDocumentData(
  documents,
  originalKey,
  originalValue,
  newKey,
  newValue
) {
  // TODO: potentially optimize with partial add-remove hybrid on matching keys
  await removeDocumentData(documents, originalKey, originalValue);
  await addDocumentData(documents, newKey, newValue);
}

export async function removeDocumentData(documents, key, value) {
  for (let i = 0; i < documents.length; i++) {
    const document = documents[i];
    // TODO: replace with bulk method
    await removeData(document.id, key, value);

    if (document.doc.data[key] != null) {
      // Only remove data from documents with data
      document.doc.data[key] = document.doc.data[key].filter((x) => x != value);
      document.doc = document.doc;
      replaceInCollection(document);
    }
  }
}

export async function handleNewDocuments(ids, project = null) {
  const newDocs = await getDocumentsWithIds(ids, true);
  addToCollection(newDocs);

  if (project != null) {
    // Add docs to project if relevant
    await addDocsToProject(project, newDocs, false);
  }
}

export function selectDocument(document, shiftKey = true) {
  layout.selectedMap = { ...layout.selectedMap, [document.id]: document };
  if (shiftKey && lastSelected != null) {
    // Handle shift key for multiple selection
    const lastSelectedIndex = getIndex(lastSelected);
    if (lastSelectedIndex != null) {
      const toIndex = getIndex(document);
      if (toIndex != null) {
        for (
          let i = Math.min(lastSelectedIndex, toIndex) + 1;
          i < Math.max(lastSelectedIndex, toIndex);
          i++
        ) {
          selectDocument(documents.documents[i], false);
        }
      }
    }
  }
  lastSelected = document;
}

export function unselectAll() {
  layout.selectedMap = {};
  lastSelected = null;
}

export async function initDocuments() {
  const results = await wrapSeparate(
    null,
    search,
    () => getDocuments({ status: PENDING }) // disregard pagination of processing docs (only show first 25)
  );
  documents.processingDocumentsRaw = results.results;
}

export async function addDocsToProject(project, documents, showToast = true) {
  documents = documents.filter((doc) => !doc.projectIds.includes(project.id));
  if (documents.length == 0) return;
  await wrapLoad(layout, async () => {
    await addDocumentsToProject(
      project.id,
      documents.map((doc) => doc.id)
    );
    documents.forEach((doc) =>
      updateInCollection(
        doc,
        (d) => (d.doc = { ...d.doc, projects: addToArrayIfUnique(d.projectIds, project.id) })
      )
    );
  });
  if (!layout.error && showToast) {
    pushToast(
      `Successfully added ${handlePlural(
        documents.length,
        "document",
        true
      )} to ${project.title}.`
    );
  }
}

export async function removeDocsFromProject(
  project,
  documents,
  showToast = true
) {
  documents = documents.filter((doc) => doc.projectIds.includes(project.id));
  if (documents.length == 0) return;
  await wrapLoad(layout, async () => {
    await removeDocumentsFromProject(
      project.id,
      documents.map((doc) => doc.id)
    );
    documents.forEach((doc) =>
      updateInCollection(
        doc,
        (d) =>
          (d.doc = {
            ...d.doc,
            projects: removeFromArray(d.projectIds, project.id),
          })
      )
    );
  });
  if (!layout.error && showToast) {
    pushToast(
      `Successfully removed ${handlePlural(
        documents.length,
        "document",
        true
      )} from project (${project.title}).`
    );
  }
}
