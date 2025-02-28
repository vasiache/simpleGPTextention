import * as vscode from 'vscode';
import fetch from 'cross-fetch'; // Импортируем fetch из cross-fetch

interface Prompt {
    name: string;
    content: string;
}

let customPrompts: Prompt[] = []; // Для простоты храним в оперативной памяти

let chatPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {

    // Команда для добавления нового промта
    const addPromptCommand = vscode.commands.registerCommand('extension.addPrompt', async () => {
        const name = await vscode.window.showInputBox({ prompt: 'Введите имя промта' });
        if (!name) {
            vscode.window.showErrorMessage('Имя промта не может быть пустым.');
            return;
        }
        const content = await vscode.window.showInputBox({ prompt: 'Введите текст промта' });
        if (!content) {
            vscode.window.showErrorMessage('Текст промта не может быть пустым.');
            return;
        }
        customPrompts.push({ name, content });
        vscode.window.showInformationMessage(`Промт "${name}" добавлен!`);
    });

    // Команда для отправки запроса с выбранным промтом
    const sendPromptCommand = vscode.commands.registerCommand('extension.sendPrompt', async () => {
        if (customPrompts.length === 0) {
            vscode.window.showWarningMessage('Нет доступных промтов. Добавьте промт через команду "Добавить новый промт".');
            return;
        }

        // Получаем выделенный текст или весь текст документа
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('Нет открытого редактора.');
            return;
        }
        let selectedText = editor.document.getText(editor.selection);
        if (!selectedText) {
            selectedText = editor.document.getText();
        }

        // Выбор промта через QuickPick
        const picked = await vscode.window.showQuickPick(customPrompts.map(p => p.name), { placeHolder: 'Выберите промт для отправки запроса' });
        if (!picked) {
            return;
        }
        const prompt = customPrompts.find(p => p.name === picked);
        if (!prompt) {
            vscode.window.showErrorMessage('Промт не найден.');
            return;
        }

        // Формирование запроса в формате OpenAI API
        const requestBody = {
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: prompt.content },
                { role: "user", content: selectedText }
            ]
        };

        // Получаем настройки из конфигурации
        const config = vscode.workspace.getConfiguration('myExtension');
        const apiKey = config.get<string>('apiKey') || '';
        const apiUrl = config.get<string>('apiUrl') || 'http://localhost:8000/llm/v1/chat/completion';

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody)
            });
            if (!response.ok) {
                vscode.window.showErrorMessage(`Ошибка запроса: ${response.statusText}`);
                return;
            }
            const data = await response.json();
            // Выводим результат в чат-окне
            openChatWindow(JSON.stringify(data, null, 2));
        } catch (error: any) {
            vscode.window.showErrorMessage(`Ошибка: ${error.message}`);
        }
    });

    // Команда для открытия окна чата
    const openChatCommand = vscode.commands.registerCommand('extension.openChat', () => {
        openChatWindow('');
    });

    context.subscriptions.push(addPromptCommand, sendPromptCommand, openChatCommand);
}

// Функция для открытия (или обновления) окна чата
function openChatWindow(content: string) {
    if (chatPanel) {
        chatPanel.webview.html = getWebviewContent(content);
        chatPanel.reveal(vscode.ViewColumn.Beside);
    } else {
        chatPanel = vscode.window.createWebviewPanel(
            'chatWindow',
            'Chat',
            vscode.ViewColumn.Beside,
            {}
        );
        chatPanel.webview.html = getWebviewContent(content);
        chatPanel.onDidDispose(() => {
            chatPanel = undefined;
        });
    }
}

// Генерация HTML-содержимого для WebView
function getWebviewContent(content: string): string {
    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Chat</title>
    <style>
      body { font-family: sans-serif; padding: 10px; }
      pre { background: #f3f3f3; padding: 10px; }
    </style>
</head>
<body>
    <h2>Ответ от сервера</h2>
    <pre>${content}</pre>
</body>
</html>`;
}

export function deactivate() {}
