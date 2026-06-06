[Setup]
AppName=CRM для малого бизнеса
AppVersion=1.0.0
AppPublisher=Artic Gubare
DefaultDirName={autopf}\CRMApp
DefaultGroupName=CRM App
OutputDir=..\output\installer
OutputBaseFilename=CRM-Setup
Compression=lzma
SolidCompression=yes
LicenseFile=LICENSE.rtf

[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"

[Files]
; Исполняемый файл
Source: "..\bin\neutralino-win_x64.exe"; DestDir: "{app}"; DestName: "crm-app.exe"; Flags: ignoreversion

Source: "..\АННОТАЦИЯ_К_СОГЛАШЕНИЯМ.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\ПОЛИТИКА_КОНФИДЕНЦИАЛЬНОСТИ.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\ПОЛЬЗОВАТЕЛЬСКОЕ_СОГЛАШЕНИЕ.md"; DestDir: "{app}"; Flags: ignoreversion

; Файл настроек по умолчанию
Source: "settings.json"; DestDir: "{app}\crm_data"; DestName: "settings.json"; Flags: onlyifdoesntexist
; ВСЕ файлы ресурсов (рекурсивно)
Source: "..\resources\*"; DestDir: "{app}\resources"; Flags: recursesubdirs createallsubdirs ignoreversion

; Конфигурация
Source: "..\neutralino.config.json"; DestDir: "{app}"; Flags: ignoreversion

; Лицензионные документы (копируем для ознакомления)
Source: "LICENSE.rtf"; DestDir: "{app}\docs"; DestName: "Лицензионное_соглашение.rtf"; Flags: ignoreversion

; Дополнительные файлы
Source: "..\package.json"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\CRM для малого бизнеса"; Filename: "{app}\crm-app.exe"; IconFilename: "{app}\resources\icons\logo.ico"
Name: "{autodesktop}\CRM для малого бизнеса"; Filename: "{app}\crm-app.exe"; IconFilename: "{app}\resources\icons\logo.ico"
[Run]
Filename: "{app}\crm-app.exe"; Description: "{cm:LaunchProgram,CRM для малого бизнеса}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"