import { Svue } from "svue";
import { viewer } from "./viewer";
import { layout, annotationValid } from "./layout";
import { withinPercent } from "@/util/epsilon";
import { tick } from "svelte";

const DEFAULT_ASPECT = 11 / 8.5; // letter size paper
const DEFAULT_VISIBLE_OFFSET = -60; // offset at which to start next page number

// Zoom
export const ZOOM_VALUES = [50, 75, 100, 150, 200];
export const ZOOM_OPTIONS = ["Fit", ...ZOOM_VALUES.map(x => `${x}%`)];
const ZOOM_PERCENTS = ZOOM_VALUES.map(x => x / 100);
export const BASE_WIDTH = 500;

export const BREAKPOINT = 600;

export const renderer = new Svue({
  data() {
    return {
      imageAspects: [],
      textAspects: [],
      mode: "image",
      width: ZOOM_PERCENTS[ZOOM_VALUES.length - 1] * BASE_WIDTH,
      originalWidth: ZOOM_PERCENTS[ZOOM_VALUES.length - 1] * BASE_WIDTH,
      zoom: ZOOM_OPTIONS[ZOOM_OPTIONS.length - 1],
      basePageRail: 69,
      baseSmallRail: 10,
      verticalPageMargin: 6,
      baseVerticalDocumentMargin: 18,
      annotationDocumentMargin: 60,
      bodyHeight: 0,
      top: 0,
      elem: null,
      defaultAspect: DEFAULT_ASPECT,
      visibleOffset: DEFAULT_VISIBLE_OFFSET,
      viewer,
      layout,
      blockScrollEvent: false,
      rememberPage: null
    };
  },
  watch: {
    viewer(viewer) {
      if (viewer.pageAspects != null) initAspects();
    }
  },
  computed: {
    showRail(originalWidth) {
      return originalWidth >= BREAKPOINT;
    },
    pageRail(basePageRail, baseSmallRail, showRail) {
      return showRail ? basePageRail : baseSmallRail;
    },
    annotationDialogOpen(layout) {
      return layout.displayAnnotate;
    },
    verticalDocumentMargin(
      baseVerticalDocumentMargin,
      annotationDocumentMargin,
      annotationDialogOpen
    ) {
      return (
        baseVerticalDocumentMargin +
        (annotationDialogOpen ? annotationDocumentMargin : 0)
      );
    },
    aspects(mode, imageAspects, textAspects) {
      if (mode == "image") return imageAspects;
      if (mode == "text") return textAspects;
      throw new Error("Invalid mode");
    },
    fullPageWidth(width, pageRail) {
      return width + pageRail * 2;
    },
    bottom(top, bodyHeight) {
      return top + bodyHeight;
    },
    loaded(viewer) {
      return viewer.loaded;
    },
    pageCount(aspects) {
      return aspects.length;
    },
    averageAspect(aspects) {
      let sum = 0;
      let count = 0;
      for (let i = 0; i < aspects.length; i++) {
        const aspect = aspects[i].aspect;
        if (aspect != null) {
          sum += aspect;
          count++;
        }
      }
      if (count != 0) return sum / count;
      return this.defaultAspect;
    },
    computedAspects(aspects, averageAspect) {
      return aspects.map(aspect => ({
        ...aspect,
        aspect: aspect.aspect == null ? averageAspect : aspect.aspect
      }));
    },
    heights(width, verticalPageMargin, computedAspects) {
      return computedAspects.map(aspect =>
        heightOfAspect(aspect.aspect, width, verticalPageMargin)
      );
    },
    currentPageNumber(
      heights,
      top,
      verticalPageMargin,
      verticalDocumentMargin
    ) {
      let offset = verticalDocumentMargin + verticalPageMargin;
      for (let i = 0; i < heights.length; i++) {
        if (offset >= top) return i;
        offset += heights[i];
      }
      return heights.length - 1; // return last page if nothing matched
    },
    visiblePageNumber(
      heights,
      top,
      verticalPageMargin,
      verticalDocumentMargin,
      visibleOffset,
      rememberPage
    ) {
      if (rememberPage != null) return rememberPage;
      let offset = verticalDocumentMargin + verticalPageMargin + visibleOffset;
      for (let i = 0; i < heights.length; i++) {
        if (offset >= top) return i;
        offset += heights[i];
      }
      return heights.length; // return last page if nothing matched
    },
    pagesAboveTheFold(elementsToShow, top) {
      return elementsToShow
        .filter(e => e.type == "page" && e.top < top)
        .map(x => x.number);
    },
    elementsToShow(heights, verticalDocumentMargin, top, bottom) {
      if (heights.length == 0) return [];

      let totalHeight = verticalDocumentMargin;
      let chunks = [];

      let firstPageEncountered = false;
      let lastPageOffset = null;

      for (let i = 0; i < heights.length; i++) {
        const height = heights[i];

        if (!firstPageEncountered && totalHeight + height > top) {
          // First page encountered
          chunks.push({
            type: "space",
            height: totalHeight
          });
          firstPageEncountered = true;
        }
        if (totalHeight + height > top && totalHeight <= bottom) {
          // Page is visible
          chunks.push({
            type: "page",
            top: totalHeight,
            number: i
          });
          lastPageOffset = totalHeight + height;
        }

        totalHeight += height;
      }

      // Add document margin at the bottom.
      totalHeight += verticalDocumentMargin;

      // Place final gap
      const offset = totalHeight - lastPageOffset;
      if (offset != 0) {
        chunks.push({
          type: "space",
          height: offset
        });
      }

      return chunks;
    },
    aspectRuns(computedAspects) {
      // Helper methods
      const freshAspect = (start = 0) => ({
        total: 0,
        count: 0,
        start,
        skipStartPageNumber: false
      });

      const addRun = end => {
        // Skip empty runs
        if (end == currentRun.start) return;

        // Add to the page objects and reset the run
        pageObjects.push({ type: "pages", end, ...currentRun });
        currentRun = freshAspect(end);
      };

      // Initialize objects
      let pageObjects = [];
      let currentRun = freshAspect();

      let i;
      for (i = 0; i < computedAspects.length; i++) {
        const { aspect, note } = computedAspects[i];
        let skipStartPageNumber = false;

        if (note != null) {
          addRun(i);
          pageObjects.push({ type: "note", note, page: i });
          // Don't show the first page in a run of notes
          skipStartPageNumber = true;
        }

        if (skipStartPageNumber) {
          currentRun.skipStartPageNumber = true;
          skipStartPageNumber = false;
        }
        currentRun.total += aspect;
        currentRun.count++;
      }
      addRun(i);

      return pageObjects;
    },
    overallHeight(
      computedAspects,
      width,
      verticalDocumentMargin,
      verticalPageMargin
    ) {
      let sum = verticalDocumentMargin * 2;
      for (let i = 0; i < computedAspects.length; i++) {
        const aspect = computedAspects[i].aspect;
        const height = width * aspect;
        sum += height + verticalPageMargin * 2;
      }
      return sum;
    }
  }
});

function initAspects() {
  renderer.imageAspects = viewer.pageAspects.map(aspect => ({ aspect }));
  renderer.textAspects = viewer.pageAspects.map(_ => ({ aspect: null }));
}

function heightOfAspect(aspect, width, verticalPageMargin) {
  return width * aspect + verticalPageMargin * 2;
}

export function setAspect(pageNumber, aspect) {
  const existingInfo = renderer.aspects[pageNumber];

  // Don't trigger updates on same aspect
  if (withinPercent(existingInfo.aspect, aspect, 0.0001)) return 0;

  // Tabulate previous heights before page we're updating
  let prevHeights = 0;
  const currentPageNumber = renderer.currentPageNumber;
  for (let i = 0; i < currentPageNumber; i++) {
    prevHeights += renderer.heights[i];
  }

  if (renderer.mode == "image") {
    renderer.imageAspects[pageNumber] = { ...existingInfo, aspect };
    renderer.imageAspects = renderer.aspects;
  } else if (renderer.mode == "text") {
    renderer.textAspects[pageNumber] = { ...existingInfo, aspect };
    renderer.textAspects = renderer.aspects;
  } else throw new Error("Invalid mode");

  // Tabulate current heights before page we're updating
  let currentHeights = 0;
  for (let i = 0; i < currentPageNumber; i++) {
    currentHeights += renderer.heights[i];
  }

  // Return an offset to scroll to accommodate page jumps above the fold.
  return currentHeights - prevHeights;
}

/**
 * Scrolls the renderer to the desired position.
 * @param {number} pos The absolute scroll position to set.
 */
export async function scroll(pos) {
  // Fix bounds
  const maxPos = renderer.overallHeight - renderer.bodyHeight;
  if (pos > maxPos) pos = maxPos;
  if (pos < 0) pos = 0;

  renderer.top = pos;
  // Let DOM updates sink in before updating scroll top
  await tick();
  renderer.blockScrollEvent = true;
  renderer.elem.scrollTop = pos;

  return pos;
}

export async function scrollOffset(offset) {
  scroll(renderer.elem.scrollTop + offset);
}

export function getPosition() {
  // Like getting current page number, but rounds to page before
  const heights = renderer.heights;
  const top = renderer.top;

  let totalHeight = renderer.verticalDocumentMargin;
  for (let i = 0; i < heights.length; i++) {
    totalHeight += heights[i];
    if (totalHeight >= top + 1) {
      return i;
    }
  }
}

export async function restorePosition(pos, closeSidebarIfNeeded = true) {
  if (closeSidebarIfNeeded) await closeSidebarIfFullWidth();

  // Clear remembered page so it does not influence results
  if (renderer.rememberPage != null) {
    renderer.rememberPage = null;
    await tick();
  }

  // Scroll to a desired page number.
  const heights = renderer.heights;

  let totalHeight = renderer.verticalDocumentMargin;
  for (let i = 0; i < pos; i++) {
    totalHeight += heights[i];
  }
  await scroll(totalHeight);
}

export async function changeMode(mode) {
  await closeSidebarIfFullWidth();

  // No effect when mode is same
  if (mode == renderer.mode) return;

  // Change the mode while preserving position.
  const position = getPosition();

  renderer.mode = mode;

  restorePosition(position);

  // Deselect any text
  if (window.getSelection) window.getSelection().removeAllRanges();
}

export async function scrollVisibleAnnotationIntoView() {
  await tick();
  const elem = layout.displayedAnnotationElem;
  // Scroll into view if possible
  if (elem != null && elem.scrollIntoView) {
    elem.scrollIntoView();
    // Scroll a little above
    scrollOffset(-30);
  }
}

export async function showAnnotation(annotation, scrollIntoView = false) {
  await closeSidebarIfFullWidth();

  if (!annotationValid(annotation)) return;
  layout.annotateMode = "view";
  layout.displayedAnnotation = annotation;

  if (scrollIntoView) {
    await restorePosition(annotation.page);
    await scrollVisibleAnnotationIntoView();
  }
}

// Zoom

export function zoomFit(closeSidebarIfNeeded = true, multiplier = 1) {
  const page = renderer.visiblePageNumber;
  renderer.zoom = ZOOM_OPTIONS[0]; // fit
  renderer.width =
    (renderer.elem.offsetWidth - renderer.pageRail * 2) * multiplier;
  restorePosition(page - 1, closeSidebarIfNeeded);
}

export function zoomPercent(percent) {
  const page = renderer.visiblePageNumber;
  let closest = null;
  let minDelta = null;
  for (let i = 1; i < ZOOM_OPTIONS.length; i++) {
    const option = parseFloat(ZOOM_OPTIONS[i]) / 100;
    if (option != null && !isNaN(option)) {
      const diff = Math.abs(option - percent);
      if (minDelta == null || diff < minDelta) {
        minDelta = diff;
        closest = ZOOM_OPTIONS[i];
      }
    }
  }
  if (closest != null) {
    renderer.zoom = closest;
  }
  renderer.width = BASE_WIDTH * percent;
  restorePosition(page - 1);
}

export function zoomIn() {
  const currentWidth = renderer.width;
  for (let i = 0; i < ZOOM_PERCENTS.length; i++) {
    const percent = ZOOM_PERCENTS[i];
    if (BASE_WIDTH * percent > currentWidth) {
      zoomPercent(percent);
      return;
    }
  }
  // No more zoom possible, so don't do anything
}

export function zoomOut() {
  const currentWidth = renderer.width;
  for (let i = ZOOM_PERCENTS.length - 1; i >= 0; i--) {
    const percent = ZOOM_PERCENTS[i];
    if (BASE_WIDTH * percent < currentWidth) {
      zoomPercent(percent);
      return;
    }
  }
  // No more zoom possible, so zoom to max
}

// Layout
export async function toggleSidebar() {
  await showSidebar(!layout.showSidebar);
}

export async function showSidebar(show) {
  // Keep track of previous page
  if (show) {
    renderer.rememberPage = renderer.visiblePageNumber;
  }
  layout.showSidebar = show;
  await tick();
  let restore = null;
  if (!show) {
    // Pop previously remembered page
    if (renderer.rememberPage != null) {
      restore = renderer.rememberPage - 1;
      renderer.rememberPage = null;
    }
  }
  if (renderer.zoom == ZOOM_OPTIONS[0]) {
    // Zoom and preserve remembered page
    const prevRemember = renderer.rememberPage;
    zoomFit(false);
    renderer.rememberPage = prevRemember;
  }
  // Restore page if necessary
  if (restore != null) restorePosition(restore, false);
}

export async function closeSidebarIfFullWidth() {
  if (renderer.width - layout.sidebarWidth <= 0) {
    // Close sidebar if necessary
    await showSidebar(false);
  }
}
