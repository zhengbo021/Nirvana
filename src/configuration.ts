import * as vscode from 'vscode';

export interface ConfigurationOption {
    key: string;
    label: string;
    description: string;
    getCurrentValue: () => boolean;
    toggle: () => Promise<boolean>;
}

const CONFIGURATION_SECTION = 'nirvana';

/**
 * Get the current configuration instance
 */
const getConfiguration = (): vscode.WorkspaceConfiguration => {
    return vscode.workspace.getConfiguration(CONFIGURATION_SECTION);
};

/**
 * Get the convertLetConstToVar setting
 */
export function getConvertLetConstToVar(): boolean {
    return getConfiguration().get<boolean>('convertLetConstToVar', false);
}

/**
 * Set the convertLetConstToVar setting
 */
export async function setConvertLetConstToVar(value: boolean, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<void> {
    await getConfiguration().update('convertLetConstToVar', value, target);
}

/**
 * Toggle the convertLetConstToVar setting
 */
export async function toggleConvertLetConstToVar(): Promise<boolean> {
    const currentValue = getConvertLetConstToVar();
    const newValue = !currentValue;
    await setConvertLetConstToVar(newValue);
    return newValue;
}

/**
 * Get the autoImportDependencies setting
 */
export function getAutoImportDependencies(): boolean {
    return getConfiguration().get<boolean>('autoImportDependencies', true);
}

/**
 * Set the autoImportDependencies setting
 */
export async function setAutoImportDependencies(value: boolean, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<void> {
    await getConfiguration().update('autoImportDependencies', value, target);
}

/**
 * Toggle the autoImportDependencies setting
 */
export async function toggleAutoImportDependencies(): Promise<boolean> {
    const currentValue = getAutoImportDependencies();
    const newValue = !currentValue;
    await setAutoImportDependencies(newValue);
    return newValue;
}

/**
 * Get the autoImportCurrentFile setting
 */
export function getAutoImportCurrentFile(): boolean {
    return getConfiguration().get<boolean>('autoImportCurrentFile', true);
}

/**
 * Set the autoImportCurrentFile setting
 */
export async function setAutoImportCurrentFile(value: boolean, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<void> {
    await getConfiguration().update('autoImportCurrentFile', value, target);
}

/**
 * Toggle the autoImportCurrentFile setting
 */
export async function toggleAutoImportCurrentFile(): Promise<boolean> {
    const currentValue = getAutoImportCurrentFile();
    const newValue = !currentValue;
    await setAutoImportCurrentFile(newValue);
    return newValue;
}

/**
 * Get all available configuration options
 */
export function getConfigurationOptions(): ConfigurationOption[] {
    return [
        {
            key: 'convertLetConstToVar',
            label: 'convertLetConstToVar',
            description: 'Convert let/const to var when executing code',
            getCurrentValue: () => getConvertLetConstToVar(),
            toggle: () => toggleConvertLetConstToVar()
        },
        {
            key: 'autoImportDependencies',
            label: 'autoImportDependencies',
            description: 'Automatically import external dependencies used in code blocks',
            getCurrentValue: () => getAutoImportDependencies(),
            toggle: () => toggleAutoImportDependencies()
        },
        {
            key: 'autoImportCurrentFile',
            label: 'autoImportCurrentFile',
            description: 'Automatically import current file to make local functions available in REPL',
            getCurrentValue: () => getAutoImportCurrentFile(),
            toggle: () => toggleAutoImportCurrentFile()
        }
        // Add more configuration options here in the future
    ];
}

/**
 * Show configuration options to the user
 */
export async function showConfigurationOptions(): Promise<void> {
    const configOptions = getConfigurationOptions();

    const quickPickItems = configOptions.map(option => {
        const currentValue = option.getCurrentValue();
        const toggleText = currentValue ? 'Disable' : 'Enable';
        return {
            label: `${toggleText} ${option.label}`,
            description: option.description,
            option: option
        };
    });

    const selection = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: 'Select a configuration option to toggle'
    });

    if (selection) {
        const newValue = await selection.option.toggle();
        const statusText = newValue ? 'enabled' : 'disabled';
        vscode.window.showInformationMessage(`${selection.option.label} has been ${statusText}`);
    }
}
