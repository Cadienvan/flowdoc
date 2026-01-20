// @ts-check

/**
 * FlowDoc Webview Main Script
 * Handles UI interactions and communication with the extension
 */

(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  /** @type {{ currentNode: any, prevId: string | null, nextOptions: any[], breadcrumbs: any[] }} */
  let state = {
    currentNode: null,
    prevId: null,
    nextOptions: [],
    breadcrumbs: [],
  };

  /** @type {any[]} */
  let warnings = [];

  /** @type {any[]} */
  let errors = [];

  // DOM Elements
  const topicTitle = document.getElementById("topic-title");
  const nodeId = document.getElementById("node-id");
  const nodeStep = document.getElementById("node-step");
  const nodeDependencyNote = document.getElementById("node-dependency-note");
  const linksSection = document.getElementById("links-section");
  const nodeLinks = document.getElementById("node-links");
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  const navInfo = document.getElementById("nav-info");
  const branchSelector = document.getElementById("branch-selector");
  const branchList = document.getElementById("branch-list");
  const warningsToggle = document.getElementById("warnings-toggle");
  const warningsCount = document.getElementById("warnings-count");
  const warningsPanel = document.getElementById("warnings-panel");
  const warningsList = document.getElementById("warnings-list");
  const closeWarnings = document.getElementById("close-warnings");
  const errorsToggle = document.getElementById("errors-toggle");
  const errorsCount = document.getElementById("errors-count");
  const errorsPanel = document.getElementById("errors-panel");
  const errorsList = document.getElementById("errors-list");
  const closeErrors = document.getElementById("close-errors");
  const goToSource = document.getElementById("go-to-source");
  const btnHome = document.getElementById("btn-home");
  const btnBreadcrumbs = document.getElementById("btn-breadcrumbs");
  const breadcrumbsPanel = document.getElementById("breadcrumbs-panel");
  const breadcrumbsList = document.getElementById("breadcrumbs-list");
  const closeBreadcrumbs = document.getElementById("close-breadcrumbs");
  const followMeCheckbox = document.getElementById("follow-me");

  // Event Listeners
  btnPrev?.addEventListener("click", () => {
    if (state.prevId) {
      vscode.postMessage({ command: "navigate", direction: "prev" });
    }
  });

  btnNext?.addEventListener("click", () => {
    if (state.nextOptions.length === 1) {
      vscode.postMessage({ command: "selectBranch", nodeId: state.nextOptions[0].id });
    } else if (state.nextOptions.length > 1) {
      branchSelector?.removeAttribute("hidden");
    }
  });

  goToSource?.addEventListener("click", () => {
    vscode.postMessage({ command: "goToSource" });
  });

  warningsToggle?.addEventListener("click", () => {
    warningsPanel?.toggleAttribute("hidden");
  });

  closeWarnings?.addEventListener("click", () => {
    warningsPanel?.setAttribute("hidden", "");
  });

  errorsToggle?.addEventListener("click", () => {
    errorsPanel?.toggleAttribute("hidden");
  });

  closeErrors?.addEventListener("click", () => {
    errorsPanel?.setAttribute("hidden", "");
  });

  // Home button
  btnHome?.addEventListener("click", () => {
    vscode.postMessage({ command: "goHome" });
  });

  // Breadcrumbs toggle
  btnBreadcrumbs?.addEventListener("click", () => {
    breadcrumbsPanel?.toggleAttribute("hidden");
  });

  closeBreadcrumbs?.addEventListener("click", () => {
    breadcrumbsPanel?.setAttribute("hidden", "");
  });

  // Follow me checkbox
  followMeCheckbox?.addEventListener("change", event => {
    // @ts-ignore
    const enabled = event.target?.checked ?? true;
    vscode.postMessage({ command: "setFollowMe", enabled });
  });

  // Handle messages from extension
  window.addEventListener("message", event => {
    const message = event.data;

    switch (message.command) {
      case "setTopic":
        if (topicTitle) {
          topicTitle.textContent = `📚 ${message.topic}`;
        }
        break;

      case "updateNode":
        state = {
          currentNode: message.node,
          prevId: message.prevId,
          nextOptions: message.nextOptions,
          breadcrumbs: message.breadcrumbs || [],
        };
        renderNode();
        renderBreadcrumbs();
        break;

      case "showWarnings":
        warnings = message.warnings;
        renderWarnings();
        break;

      case "showErrors":
        errors = message.errors;
        renderErrors();
        break;
    }
  });

  /**
   * Render current node
   */
  function renderNode() {
    const node = state.currentNode;
    if (!node) {
      return;
    }

    // Hide branch selector
    branchSelector?.setAttribute("hidden", "");

    // Update node info
    if (nodeId) {
      nodeId.textContent = node.id;
    }
    if (nodeStep) {
      nodeStep.textContent = node.step;
    }
    if (nodeDependencyNote) {
      nodeDependencyNote.textContent = node.dependencyNote || "";
    }

    // Update links
    if (nodeLinks && linksSection) {
      nodeLinks.innerHTML = "";
      if (node.links && node.links.length > 0) {
        linksSection.removeAttribute("hidden");
        node.links.forEach((/** @type {any} */ link) => {
          const li = document.createElement("li");
          const a = document.createElement("a");
          a.textContent = link.label || link.target;
          a.addEventListener("click", () => {
            vscode.postMessage({ command: "openLink", link });
          });

          const typeSpan = document.createElement("span");
          typeSpan.className = "link-type";
          typeSpan.textContent = `(${link.type})`;

          li.appendChild(a);
          li.appendChild(typeSpan);
          nodeLinks.appendChild(li);
        });
      } else {
        linksSection.setAttribute("hidden", "");
      }
    }

    // Update navigation buttons
    if (btnPrev) {
      // @ts-ignore
      btnPrev.disabled = !state.prevId;
    }
    if (btnNext) {
      // @ts-ignore
      btnNext.disabled = state.nextOptions.length === 0;
    }

    // Update nav info
    if (navInfo) {
      const parts = [];
      if (state.prevId) {
        // Check if prev is cross-repo
        const prevIsExternal = state.prevId.includes("@");
        parts.push(prevIsExternal ? `← 🔗 ${state.prevId}` : `← ${state.prevId}`);
      }
      if (state.nextOptions.length === 1) {
        const nextIsExternal = state.nextOptions[0].isExternal;
        parts.push(nextIsExternal ? `🔗 ${state.nextOptions[0].id} →` : `${state.nextOptions[0].id} →`);
      } else if (state.nextOptions.length > 1) {
        const externalCount = state.nextOptions.filter((/** @type {any} */ o) => o.isExternal).length;
        if (externalCount > 0) {
          parts.push(`${state.nextOptions.length} branches (${externalCount} 🔗) →`);
        } else {
          parts.push(`${state.nextOptions.length} branches →`);
        }
      }
      navInfo.textContent = parts.join(" | ");
    }

    // Render branch options if multiple
    if (branchList && state.nextOptions.length > 1) {
      branchList.innerHTML = "";
      state.nextOptions.forEach((/** @type {any} */ option) => {
        const li = document.createElement("li");
        const btn = document.createElement("button");

        // Add external class for cross-repo children
        if (option.isExternal) {
          btn.classList.add("external-branch");
        }

        const idSpan = document.createElement("span");
        idSpan.className = "branch-id";
        idSpan.textContent = option.id;

        const stepSpan = document.createElement("span");
        stepSpan.className = "branch-step";
        stepSpan.textContent = option.step;

        // Add external indicator icon
        if (option.isExternal) {
          const extIcon = document.createElement("span");
          extIcon.className = "external-icon";
          extIcon.textContent = " 🔗";
          extIcon.title = "Opens in another repository";
          btn.appendChild(extIcon);
        }

        btn.appendChild(idSpan);
        btn.appendChild(stepSpan);
        btn.addEventListener("click", () => {
          vscode.postMessage({ command: "selectBranch", nodeId: option.id });
        });

        li.appendChild(btn);
        branchList.appendChild(li);
      });
    }
  }

  /**
   * Render warnings
   */
  function renderWarnings() {
    if (!warningsToggle || !warningsCount || !warningsList) {
      return;
    }

    if (warnings.length > 0) {
      warningsToggle.removeAttribute("hidden");
      warningsCount.textContent = String(warnings.length);

      warningsList.innerHTML = "";
      warnings.forEach((/** @type {any} */ warning) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <span class="warning-type">${warning.type}</span>: 
          <span class="warning-node">${warning.nodeId}</span><br>
          ${warning.message}
        `;
        warningsList.appendChild(li);
      });
    } else {
      warningsToggle.setAttribute("hidden", "");
      warningsPanel?.setAttribute("hidden", "");
    }
  }

  /**
   * Render errors
   */
  function renderErrors() {
    if (!errorsToggle || !errorsCount || !errorsList) {
      return;
    }

    if (errors.length > 0) {
      errorsToggle.removeAttribute("hidden");
      errorsCount.textContent = String(errors.length);

      errorsList.innerHTML = "";
      errors.forEach((/** @type {any} */ error) => {
        const li = document.createElement("li");
        const fileName = error.sourceFile?.split("/").pop() || "unknown";
        li.innerHTML = `
          <span class="error-type">${error.type}</span><br>
          ${error.message}<br>
          <span class="error-file">${fileName}:${error.sourceLine}</span>
        `;
        errorsList.appendChild(li);
      });
    } else {
      errorsToggle.setAttribute("hidden", "");
      errorsPanel?.setAttribute("hidden", "");
    }
  }

  /**
   * Render breadcrumbs panel
   */
  function renderBreadcrumbs() {
    if (!breadcrumbsList) {
      return;
    }

    breadcrumbsList.innerHTML = "";

    state.breadcrumbs.forEach((/** @type {any} */ crumb) => {
      const li = document.createElement("li");
      li.className = "breadcrumb-item" + (crumb.isCurrent ? " current" : "");

      const btn = document.createElement("button");

      const stepSpan = document.createElement("span");
      stepSpan.className = "breadcrumb-step";
      stepSpan.textContent = `${crumb.step}`;

      const idSpan = document.createElement("span");
      idSpan.className = "breadcrumb-id";
      idSpan.textContent = crumb.id;

      btn.appendChild(stepSpan);
      btn.appendChild(idSpan);

      if (!crumb.isCurrent) {
        btn.addEventListener("click", () => {
          vscode.postMessage({ command: "jumpToNode", nodeId: crumb.id });
          breadcrumbsPanel?.setAttribute("hidden", "");
        });
      } else {
        btn.classList.add("current");
      }

      li.appendChild(btn);
      breadcrumbsList.appendChild(li);
    });
  }
})();
