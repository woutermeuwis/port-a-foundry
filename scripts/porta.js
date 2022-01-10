class module {
    static ID = 'port-a-foundry';

    static FLAGS = {
        PORTA: 'port-a-foundry'
    }

    static TEMPLATES = {
        PORTA: `modules/${this.ID}/templates/porta.hbs`
    }
}

class logger {
    static log(...args) {
        const shouldLog = game.modules.get('_dev-mode')?.api?.getPackageDebugValue(module.ID);
        if (shouldLog)
            console.log(module.ID, '|', ...args);
    }
    static forcedLog(...args) {
        console.log(module.ID, '|', ...args)
    }
}

class jsonConvert {
    static folderToJson(folder, options) {
        const children = folder.children.map(folder => this.folderToJson(folder));
        const items = folder.content.map(doc => this.docToJson(doc));

        const data = {
            name: folder.name,
            children: children,
            content: items,
            flags: {
                exportSource: {
                    world: game.world.id,
                    system: game.system.id,
                    coreVersion: game.version,
                    systemVersion: game.system.data.version
                }
            }
        };

        return data;
    }

    static docToJson(document, options) {
        const data = document.toCompendium(null, options);
        data.flags["exportSource"] = {
            world: game.world.id,
            system: game.system.id,
            coreVersion: game.version,
            systemVersion: game.system.data.version
        };
        return data;
    }
}

class importer {

    static async getOrCreateFolder(foldername, parentFolder) {

        if (!parentFolder) {
            const folder = game.items.directory.folders.find(f => f.data.name === foldername);
            if (folder)
                return folder;
        } else {
            const folder = game.items.directory.folders.find(f => f.data.name === foldername && f.data.parent === parentFolder?.id);
            if (folder)
                return folder;
        }

        const folderData = { name: foldername, type: "Item" };
        if (parentFolder)
            folderData.parent = parentFolder.id;

        return await Folder.create(folderData);
    }

    static addItemToFolder(data, parentFolder) {
        data.folder = parentFolder.id;
        Item.create(data);
    }

    static async addItemsFolder(data, parentFolder) {
        const foldername = data.name;
        const folder = await this.getOrCreateFolder(foldername, parentFolder);

        data.children.forEach(f => this.addItemsFolder(f, folder));
        data.content.forEach(i => this.addItemToFolder(i, folder));
    }

    static importJsonFile() {

        const content = `
        <form autocomplete="off" onsubmit="event.preventDefault();">

            <p class="notes">${game.i18n.format("portafoundry.import-dialog-text1")}</p>
            <p class="notes">${game.i18n.format("portafoundry.import-dialog-text2")}</p>

            <div class="form-group">

                <label for="data">${game.i18n.format("portafoundry.import-source-data-label")}<label>

                <input type="file" name="data"

            </div>

        </form
        `;

        const okButton = {
            icon: '<i class="fas fa-file-import"></i>',
            label: game.i18n.format('portafoundry.import-confirm-button-text'),
            callback: html => {
                const form = html.find("form")[0];
                if (!form.data.files.length)
                    return ui.notifications.error(game.i18n.format("portafoundry.no-file-for-upload"));

                readTextFromFile(form.data.files[0]).then(async json => {
                    const data = JSON.parse(json);
                    await this.addItemsFolder(data);
                });
            }
        }

        const cancelButton = {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.format('portafoundry.cancel-button-text')
        }

        const dialog = {
            title: game.i18n.format('portafoundry.import-dialog-title'),
            content: content,
            buttons: {
                import: okButton,
                no: cancelButton
            },
            default: "import",
        };

        const options = {
            width: 400
        };

        new Dialog(dialog, options).render(true);
    }
}


Hooks.once('devModeReady', function ({ registerPackageDebugFlag }) {
    registerPackageDebugFlag(module.ID);
});

Hooks.on("getItemDirectoryFolderContext", (html, contextEntries) => {
    contextEntries.push({
        name: game.i18n.localize("portafoundry.export-button-text"),
        icon: `<i class="fas fa-code"></i>`,
        callback: async header => {
            const li = header.parent()[0];
            const folder = game.folders.get(li.dataset.folderId);

            const json = jsonConvert.folderToJson(folder);

            const filename = `fvtt-itemfolder-${folder.name.slugify()}.json`;
            saveDataToFile(JSON.stringify(json, null, 2), "text/json", filename);
        }
    });
});

Hooks.on("renderItemDirectory", (app, html, data) => {
    const title = game.i18n.localize("portafoundry.import-button-text");
    html.append(
        `<button type='button' class='porta-import-button flex0' title='${title}'>${title}</button>`
    );

    html.on('click', '.porta-import-button', (event) => {
        importer.importJsonFile();
    })
});