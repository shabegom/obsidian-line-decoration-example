import { MarkdownView, Plugin } from "obsidian";
import {
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/rangeset";

export default class SemanticCSS extends Plugin {
  async onload() {
    // register the View Plugin with the editor
    this.registerEditorExtension(semanticPlugin(this));
  }
}

/**
 * semanticPlugin.
 *
 * This function returns a cm6 view plugin.
 * The plugin will add line decorations to the view using the buildDecorations function
 *
 * @param {SemanticCSS} plugin
 */
const semanticPlugin = (plugin: SemanticCSS) => {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor() {
        this.decorations = buildDecorations(plugin);
      }

      update(update: ViewUpdate) {
        // we only need to update the decorations if the view has changed
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(plugin);
        }
      }
    },
    {
      decorations: (v) => v.decorations,
    },
  );
};

/**
 * buildDecorations.
 *
 * This function is going to iterate over the sections in the cache and add line Decorations.
 * The line decordation will add a Data attribute which will show up on the cm-line div
 *
 * @param {SemanticCSS} plugin
 */
function buildDecorations(plugin: SemanticCSS) {
  // We will add decorations to the RangeSet builder
  const builder = new RangeSetBuilder<Decoration>();
  // Decorations need to be added in the order they appear in the document.
  // So we'll push them into this array, sort the array and then add them to the builder
  const decorations: {pos: number, deco: Decoration}[] = [];
  // Get the current active view. This is why we need to pass in the plugin
  const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
  if (activeView) {
    // reading the cache. pretty standard
    const file = activeView.file;
    const cache = plugin.app.metadataCache.getFileCache(file);
    if (cache) {
      const headings = cache.headings;
      const sections = cache.sections;
      // Iterate over the sections
      sections.forEach((section) => {
        // iterate over the headings
        if (headings) {
          headings.forEach((heading, index) => {
            // our first line decoration is added to the parent heading.
            // Using the index of the heading as a unique id
            const headingDeco = Decoration.line({
              attributes: {
                "data-heading": index.toString(),
              },
            });
            // builder takes the line locations (as an offset) and the decoratio
            decorations.push({
              pos: heading.position.start.offset,
              deco: headingDeco,
            });
            // very crude way to see if the section is below the heading
            if (
              section.position.start.line >
                heading.position.start.line
            ) {
              // if the section is below the heading, we add a line decoration
              const childOfHeadingDeco = Decoration.line({
                attributes: {
                  "data-heading-child": index.toString(),
                },
              });
              decorations.push({
                pos: section.position.start.offset,
                deco: childOfHeadingDeco,
              });
            }
          });
        }
        if (section.type === "list") {
          // if the section is a list, we add a line decoration with the starting positing as a unique id
          const listDeco = Decoration.line({
            attributes: {
              "data-list-parent": section.position.start.line.toString(),
            },
          });
          decorations.push({
            pos: section.position.start.offset,
            deco: listDeco,
          });
          const listItems = cache.listItems;
          // iterate over the list items and add line decorations if the item is within the list section.
          // You would want to make this a recursive function to handle nested lists
          listItems.forEach((item) => {
            if (
              item.position.start.offset >
                section.position.start.offset
            ) {
              const childOfListDeco = Decoration.line({
                attributes: {
                  "data-list-item-child": item.parent.toString(),
                },
              });
              decorations.push({
                pos: item.position.start.offset,
                deco: childOfListDeco,
              });
            }
          });
        }
        // add a line decoration for the section type
        const deco = Decoration.line({
          attributes: {
            "data-section-type": section.type,
          },
        });
        decorations.push({
          pos: section.position.start.offset,
          deco: deco,
        });
      });
    }
  }
  // sort the decorations by position
  const sortedDecorations = decorations.sort((a, b) => a.pos - b.pos);

  // add the sorted decorations to the builder
  sortedDecorations.forEach((deco) => {
	builder.add(deco.pos, deco.pos, deco.deco);
  });
  // return the builder
  return builder.finish();
}
