import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { listMeInstances, listVolumes, startSync, stopSync } from "../services/api";
const volumes = ref([]);
const instances = ref([]);
const syncId = ref("");
const form = ref({ instanceVolumeId: "", localPath: "", sshHost: "", sshPort: 22, sshUsername: "", sshPassword: "", conflictPolicy: "PREFER_REMOTE" });
const { t } = useI18n();
const volumeOptions = computed(() => instances.value.flatMap((i) => i.volumes.map((v) => ({ id: v.id, label: `${i.name} - ${v.serviceName}/${v.name}` }))));
async function refresh() {
    volumes.value = await listVolumes();
    instances.value = await listMeInstances();
}
async function startOne() {
    const result = await startSync({ ...form.value, sshPort: Number(form.value.sshPort), sshPassword: form.value.sshPassword || undefined });
    syncId.value = result.syncId;
}
async function stopOne() {
    if (!syncId.value)
        return;
    await stopSync(syncId.value);
    syncId.value = "";
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
    ...{ class: "fa-solid fa-hard-drive" },
});
(__VLS_ctx.t("volumes.title"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({});
for (const [v] of __VLS_getVForSourceType((__VLS_ctx.volumes))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
        key: (v.name),
    });
    (v.name);
    (v.path);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
(__VLS_ctx.t("volumes.startSync"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    value: (__VLS_ctx.form.instanceVolumeId),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "",
});
(__VLS_ctx.t("volumes.instanceVolume"));
for (const [o] of __VLS_getVForSourceType((__VLS_ctx.volumeOptions))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        key: (o.id),
        value: (o.id),
    });
    (o.label);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    placeholder: "\u0043\u003a\u005c\u005c\u0077\u006f\u0072\u006b\u0073\u0070\u0061\u0063\u0065\u005c\u005c\u0070\u0072\u006f\u006a\u0065\u0063\u0074",
});
(__VLS_ctx.form.localPath);
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    placeholder: (__VLS_ctx.t('volumes.sshHost')),
});
(__VLS_ctx.form.sshHost);
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "number",
});
(__VLS_ctx.form.sshPort);
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    placeholder: (__VLS_ctx.t('volumes.sshUser')),
});
(__VLS_ctx.form.sshUsername);
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "password",
    placeholder: (__VLS_ctx.t('volumes.sshPassword')),
});
(__VLS_ctx.form.sshPassword);
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    value: (__VLS_ctx.form.conflictPolicy),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "PREFER_LOCAL",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "PREFER_REMOTE",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "MANUAL",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.startOne) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
    ...{ class: "fa-solid fa-play" },
});
(__VLS_ctx.t("common.start"));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.stopOne) },
    ...{ class: "secondary" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.i, __VLS_intrinsicElements.i)({
    ...{ class: "fa-solid fa-stop" },
});
(__VLS_ctx.t("common.stop"));
if (__VLS_ctx.syncId) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.t("volumes.runningSync", { id: __VLS_ctx.syncId }));
}
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-solid']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-hard-drive']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-solid']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-play']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-solid']} */ ;
/** @type {__VLS_StyleScopedClasses['fa-stop']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            volumes: volumes,
            syncId: syncId,
            form: form,
            t: t,
            volumeOptions: volumeOptions,
            startOne: startOne,
            stopOne: stopOne,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
