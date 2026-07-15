/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

const messages: Record<string, string | { one: string; other: string }> = {
    "action|cancel": "Cancel",
    "action|close": "Close",
    "action|close_brand": "Close %(brand)s",
    "action|copy": "Copy",
    "action|cut": "Cut",
    "action|delete": "Delete",
    "action|edit": "Edit",
    "action|minimise": "Minimize",
    "action|paste": "Paste",
    "action|paste_match_style": "Paste and Match Style",
    "action|quit": "Quit",
    "action|redo": "Redo",
    "action|select_all": "Select All",
    "action|show_hide": "Show/Hide",
    "action|undo": "Undo",
    "action|zoom_in": "Zoom In",
    "action|zoom_out": "Zoom Out",
    "common|about": "About",
    "common|brand_help": "%(brand)s Help",
    "common|help": "Help",
    confirm_quit: "Are you sure you want to quit?",
    "edit_menu|speech": "Speech",
    "edit_menu|speech_start_speaking": "Start Speaking",
    "edit_menu|speech_stop_speaking": "Stop Speaking",
    "file_menu|label": "File",
    "icon_overlay|description_error": "Error",
    "icon_overlay|description_notifications": {
        one: "You have %(count)s unread notification.",
        other: "You have %(count)s unread notifications.",
    },
    "menu|hide": "Hide",
    "menu|hide_others": "Hide Others",
    "menu|services": "Services",
    "menu|unhide": "Unhide",
    "right_click_menu|add_to_dictionary": "Add to dictionary",
    "right_click_menu|copy_email": "Copy email address",
    "right_click_menu|copy_image": "Copy image",
    "right_click_menu|copy_image_url": "Copy image address",
    "right_click_menu|copy_link_url": "Copy link address",
    "right_click_menu|save_image_as": "Save image as...",
    "right_click_menu|save_image_as_error_description": "The image failed to save",
    "right_click_menu|save_image_as_error_title": "Failed to save image",
    "view_menu|actual_size": "Actual Size",
    "view_menu|toggle_developer_tools": "Toggle Developer Tools",
    "view_menu|toggle_full_screen": "Toggle Full Screen",
    "view_menu|view": "View",
    "window_menu|bring_all_to_front": "Bring All to Front",
    "window_menu|label": "Window",
    "window_menu|zoom": "Zoom",
};

type Variables = Record<string, number | string | undefined>;

export function _t(key: string, variables: Variables = {}): string {
    const value = messages[key];
    const template = typeof value === "string" ? value : variables.count === 1 ? value?.one : value?.other;
    if (!template) return key;
    return template.replace(/%\(([^)]+)\)s/g, (_match, name: string) => String(variables[name] ?? ""));
}
