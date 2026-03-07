import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import StatusBadge from "../components/StatusBadge.vue";
import { createForward, deleteForward, listMeForwards, listMeInstances, stopForward } from "../services/api";
const forwards = ref([]);
const instances = ref([]);
const form = ref({ instanceId: "", serviceName: "", portName: "", localPort: 30000 });
const status = ref("ALL");
const error = ref("");
const pendingDelete = ref(null);
const { t } = useI18n();
const filtered = computed(() => forwards.value.filter((f) => status.value === "ALL" || f.status === status.value));
async function refresh() {
    forwards.value = await listMeForwards();
    instances.value = await listMeInstances();
}
async function createOne() {
    await createForward({ ...form.value, localPort: Number(form.value.localPort), serviceName: form.value.serviceName || undefined });
    await refresh();
}
async function stopOne(id) {
    await stopForward(id);
    await refresh();
}
async function deleteOne(forward) {
    error.value = "";
    if (forward.status !== "STOPPED") {
        return;
    }
    pendingDelete.value = { id: forward.id, localPort: forward.localPort };
}
function cancelDelete() {
    pendingDelete.value = null;
}
async function confirmDelete() {
    if (!pendingDelete.value)
        return;
    try {
        await deleteForward(pendingDelete.value.id);
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
    ...{ class: "fa-solid fa-arrow-right-arrow-left" },
});
(__VLS_ctx.t("forwards.title"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    value: (__VLS_ctx.form.instanceId),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "",
});
(__VLS_ctx.t("forwards.instance"));
for (const [i] of __VLS_getVForSourceType((__VLS_ctx.instances))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        key: (i.id),
        value: (i.id),
    });
    (i.name);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    placeholder: (__VLS_ctx.t('forwards.serviceOptional')),
});
(__VLS_ctx.form.serviceName);
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    placeholder: (__VLS_ctx.t('forwards.portName')),
});
(__VLS_ctx.form.portName);
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "number",
    placeholder: (__VLS_ctx.t('forwards.localPort')),
});
(__VLS_ctx.form.localPort);
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.createOne) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
    ...{ class: "fa-solid fa-plus" },
});
(__VLS_ctx.t("forwards.create"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "row" },
});
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
(__VLS_ctx.t("forwards.local"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
(__VLS_ctx.t("forwards.remote"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
(__VLS_ctx.t("forwards.status"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
(__VLS_ctx.t("forwards.action"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
for (const [f] of __VLS_getVForSourceType((__VLS_ctx.filtered))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
        key: (f.id),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (f.localPort);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (f.remoteHost);
    (f.remotePort);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    /** @type {[typeof StatusBadge, ]} */ ;
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(StatusBadge, new StatusBadge({
        status: (f.status),
    }));
    const __VLS_1 = __VLS_0({
        status: (f.status),
    }, ...__VLS_functionalComponentArgsRest(__VLS_0));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.stopOne(f.id);
            } },
        ...{ class: "secondary" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
        ...{ class: "fa-solid fa-stop" },
    });
    (__VLS_ctx.t("common.stop"));
    if (f.status === 'STOPPED') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(f.status === 'STOPPED'))
                        return;
                    __VLS_ctx.deleteOne(f);
                } },
            ...{ class: "secondary" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
            ...{ class: "fa-regular fa-trash-can" },
        });
        (__VLS_ctx.t("common.delete"));
    }
}
if (__VLS_ctx.error) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "error" },
    });
    (__VLS_ctx.error);
}
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
    (__VLS_ctx.t("forwards.deleteDialogTitle"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.t("forwards.deleteConfirm", { port: __VLS_ctx.pendingDelete.localPort }));
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
/** @type {__VLS_StyleScopedClasses['fa-solid']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-arrow-right-arrow-left']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-solid']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-plus']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-solid']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-stop']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-regular']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-trash-can']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
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
            instances: instances,
            form: form,
            status: status,
            error: error,
            pendingDelete: pendingDelete,
            t: t,
            filtered: filtered,
            createOne: createOne,
            stopOne: stopOne,
            deleteOne: deleteOne,
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
