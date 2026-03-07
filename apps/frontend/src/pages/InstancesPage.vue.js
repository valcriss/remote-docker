import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import StatusBadge from "../components/StatusBadge.vue";
import SideDrawer from "../components/SideDrawer.vue";
import { createInstance, deleteInstance, listMeInstances, listTemplates, restartInstance, stopInstance } from "../services/api";
const instances = ref([]);
const templates = ref([]);
const selected = ref(null);
const q = ref("");
const status = ref("ALL");
const page = ref(1);
const pageSize = 8;
const wizardOpen = ref(false);
const wizardStep = ref(1);
const wizard = ref({ templateId: "", name: "" });
const error = ref("");
const pendingDelete = ref(null);
const { t } = useI18n();
const filtered = computed(() => instances.value
    .filter((i) => status.value === "ALL" || i.status === status.value)
    .filter((i) => `${i.name} ${i.template?.name}`.toLowerCase().includes(q.value.toLowerCase())));
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)));
const pageItems = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize));
async function refresh() {
    instances.value = await listMeInstances();
    templates.value = await listTemplates();
}
async function restart(id) {
    await restartInstance(id);
    await refresh();
}
async function stop(id) {
    await stopInstance(id);
    await refresh();
}
async function createFromWizard() {
    await createInstance({ templateId: wizard.value.templateId, name: wizard.value.name, volumeOverrides: [] });
    wizardOpen.value = false;
    wizardStep.value = 1;
    wizard.value = { templateId: "", name: "" };
    await refresh();
}
async function removeInstance(item) {
    error.value = "";
    if (item.status !== "STOPPED") {
        error.value = t("instances.deleteNotAllowed");
        return;
    }
    pendingDelete.value = { id: item.id, name: item.name };
}
function cancelDelete() {
    pendingDelete.value = null;
}
async function confirmDelete() {
    if (!pendingDelete.value)
        return;
    try {
        await deleteInstance(pendingDelete.value.id);
        if (selected.value?.id === pendingDelete.value.id) {
            selected.value = null;
        }
        pendingDelete.value = null;
        await refresh();
    }
    catch (e) {
        error.value = e?.message ?? "Delete failed.";
    }
}
onMounted(() => { void refresh(); });
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "card" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "section-head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
    ...{ class: "fa-solid fa-server" },
});
(__VLS_ctx.t("instances.title"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.wizardOpen = true;
        } },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
    ...{ class: "fa-solid fa-plus" },
});
(__VLS_ctx.t("instances.create"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    placeholder: (__VLS_ctx.t('instances.search')),
});
(__VLS_ctx.q);
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    value: (__VLS_ctx.status),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
(__VLS_ctx.t("instances.name"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
(__VLS_ctx.t("instances.status"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
(__VLS_ctx.t("instances.template"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
(__VLS_ctx.t("instances.ports"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
(__VLS_ctx.t("common.actions"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.pageItems))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selected = item;
            } },
        key: (item.id),
        ...{ class: "row-clickable" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (item.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    /** @type {[typeof StatusBadge, ]} */ ;
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(StatusBadge, new StatusBadge({
        status: (item.status),
    }));
    const __VLS_1 = __VLS_0({
        status: (item.status),
    }, ...__VLS_functionalComponentArgsRest(__VLS_0));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (item.template?.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (item.ports.length);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.restart(item.id);
            } },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
        ...{ class: "fa-solid fa-rotate-right" },
    });
    (__VLS_ctx.t("common.restart"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.stop(item.id);
            } },
        ...{ class: "secondary" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
        ...{ class: "fa-solid fa-stop" },
    });
    (__VLS_ctx.t("common.stop"));
    if (item.status === 'STOPPED') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(item.status === 'STOPPED'))
                        return;
                    __VLS_ctx.removeInstance(item);
                } },
            ...{ class: "secondary" },
            title: (__VLS_ctx.t('common.delete')),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
            ...{ class: "fa-regular fa-trash-can" },
        });
        (__VLS_ctx.t("common.delete"));
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "row pager" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.page--;
        } },
    ...{ class: "secondary" },
    disabled: (__VLS_ctx.page <= 1),
});
(__VLS_ctx.t("common.back"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.t("instances.page", { page: __VLS_ctx.page, total: __VLS_ctx.totalPages }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.page++;
        } },
    ...{ class: "secondary" },
    disabled: (__VLS_ctx.page >= __VLS_ctx.totalPages),
});
(__VLS_ctx.t("common.next"));
if (__VLS_ctx.error) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "error" },
    });
    (__VLS_ctx.error);
}
/** @type {[typeof SideDrawer, typeof SideDrawer, ]} */ ;
// @ts-ignore
const __VLS_3 = __VLS_asFunctionalComponent(SideDrawer, new SideDrawer({
    ...{ 'onClose': {} },
    open: (!!__VLS_ctx.selected),
    title: (__VLS_ctx.t('instances.details')),
}));
const __VLS_4 = __VLS_3({
    ...{ 'onClose': {} },
    open: (!!__VLS_ctx.selected),
    title: (__VLS_ctx.t('instances.details')),
}, ...__VLS_functionalComponentArgsRest(__VLS_3));
let __VLS_6;
let __VLS_7;
let __VLS_8;
const __VLS_9 = {
    onClose: (...[$event]) => {
        __VLS_ctx.selected = null;
    }
};
__VLS_5.slots.default;
if (__VLS_ctx.selected) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.selected.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.t("instances.status"));
    /** @type {[typeof StatusBadge, ]} */ ;
    // @ts-ignore
    const __VLS_10 = __VLS_asFunctionalComponent(StatusBadge, new StatusBadge({
        status: (__VLS_ctx.selected.status),
    }));
    const __VLS_11 = __VLS_10({
        status: (__VLS_ctx.selected.status),
    }, ...__VLS_functionalComponentArgsRest(__VLS_10));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({});
    (__VLS_ctx.t("instances.ports"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({});
    for (const [p] of __VLS_getVForSourceType((__VLS_ctx.selected.ports))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
            key: (p.id),
        });
        (p.serviceName);
        (p.name);
        (p.hostPort);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({});
    (__VLS_ctx.t("instances.volumes"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({});
    for (const [v] of __VLS_getVForSourceType((__VLS_ctx.selected.volumes))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
            key: (v.id),
        });
        (v.serviceName);
        (v.name);
        (v.mountPath);
    }
}
var __VLS_5;
/** @type {[typeof SideDrawer, typeof SideDrawer, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(SideDrawer, new SideDrawer({
    ...{ 'onClose': {} },
    open: (__VLS_ctx.wizardOpen),
    title: (__VLS_ctx.t('instances.wizardTitle')),
}));
const __VLS_14 = __VLS_13({
    ...{ 'onClose': {} },
    open: (__VLS_ctx.wizardOpen),
    title: (__VLS_ctx.t('instances.wizardTitle')),
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
let __VLS_16;
let __VLS_17;
let __VLS_18;
const __VLS_19 = {
    onClose: (...[$event]) => {
        __VLS_ctx.wizardOpen = false;
    }
};
__VLS_15.slots.default;
if (__VLS_ctx.wizardStep === 1) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({});
    (__VLS_ctx.t("instances.step1"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.wizard.templateId),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "",
    });
    (__VLS_ctx.t("instances.selectTemplate"));
    for (const [t] of __VLS_getVForSourceType((__VLS_ctx.templates))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (t.id),
            value: (t.id),
        });
        (t.name);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.wizardStep === 1))
                    return;
                __VLS_ctx.wizardStep = 2;
            } },
        disabled: (!__VLS_ctx.wizard.templateId),
    });
    (__VLS_ctx.t("common.next"));
}
else if (__VLS_ctx.wizardStep === 2) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({});
    (__VLS_ctx.t("instances.step2"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        placeholder: (__VLS_ctx.t('instances.instanceName')),
    });
    (__VLS_ctx.wizard.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.wizardStep === 1))
                    return;
                if (!(__VLS_ctx.wizardStep === 2))
                    return;
                __VLS_ctx.wizardStep = 1;
            } },
        ...{ class: "secondary" },
    });
    (__VLS_ctx.t("common.back"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.wizardStep === 1))
                    return;
                if (!(__VLS_ctx.wizardStep === 2))
                    return;
                __VLS_ctx.wizardStep = 3;
            } },
        disabled: (!__VLS_ctx.wizard.name),
    });
    (__VLS_ctx.t("common.next"));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({});
    (__VLS_ctx.t("instances.step3"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.t("instances.template"));
    (__VLS_ctx.templates.find(t => t.id === __VLS_ctx.wizard.templateId)?.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.t("instances.name"));
    (__VLS_ctx.wizard.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.wizardStep === 1))
                    return;
                if (!!(__VLS_ctx.wizardStep === 2))
                    return;
                __VLS_ctx.wizardStep = 2;
            } },
        ...{ class: "secondary" },
    });
    (__VLS_ctx.t("common.back"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.createFromWizard) },
    });
    (__VLS_ctx.t("common.create"));
}
var __VLS_15;
if (__VLS_ctx.pendingDelete) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "dialog-backdrop" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "card confirm-dialog" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
        ...{ class: "fa-solid fa-triangle-exclamation" },
    });
    (__VLS_ctx.t("catalog.deleteDialogTitle"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.t("instances.deleteConfirm", { name: __VLS_ctx.pendingDelete.name }));
    if (__VLS_ctx.error) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "error" },
        });
        (__VLS_ctx.error);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "row confirm-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.cancelDelete) },
        ...{ class: "secondary" },
    });
    (__VLS_ctx.t("common.cancel"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.confirmDelete) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
        ...{ class: "fa-regular fa-trash-can" },
    });
    (__VLS_ctx.t("common.delete"));
}
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['section-head']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-solid']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-server']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-solid']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-plus']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['row-clickable']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-solid']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-rotate-right']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-solid']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-stop']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-regular']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-trash-can']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['pager']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['confirm-dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-solid']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-triangle-exclamation']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['confirm-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-regular']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-trash-can']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            StatusBadge: StatusBadge,
            SideDrawer: SideDrawer,
            templates: templates,
            selected: selected,
            q: q,
            status: status,
            page: page,
            wizardOpen: wizardOpen,
            wizardStep: wizardStep,
            wizard: wizard,
            error: error,
            pendingDelete: pendingDelete,
            t: t,
            totalPages: totalPages,
            pageItems: pageItems,
            restart: restart,
            stop: stop,
            createFromWizard: createFromWizard,
            removeInstance: removeInstance,
            cancelDelete: cancelDelete,
            confirmDelete: confirmDelete,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
