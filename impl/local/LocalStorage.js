import DirectoryListing from "../../models/DirectoryListing";
var fs = require('fs');
var watch = require("node-watch");
class LocalStorage {
    constructor(db) {
        this.db = db;
    }

    getRootFolders() {
        let result = this.db.list("root_folders");
        return result;
    }

    listFilesAndFolders(rootFolder, path) {
        path = rootFolder.path + "/" + path;
        return this.getListing(path);
    }

    watchFolderForChanges(folder, addCallback, deleteCallback) {
        // need to handle recursive for non mac and Windows later
        watch(folder.path, {recursive: true}, function(event, filename) {
            if(filename.indexOf(".DS_Store") < 0) {
                let relativeFile = filename.substring(folder.path.length);
                if(relativeFile.indexOf("/")==0) {
                    relativeFile = relativeFile.substring(1);
                }
                switch(event) {
                    case "update":
                        addCallback(folder, relativeFile);
                        break;
                    case "remove":
                        deleteCallback(folder, relativeFile);
                        break;
                }

            }
        })
    }

    listFolders(path) {
        let files = [];
        let folders = [];
        if (path == null || path == "") {
            let rootFolders = this.getRootFolders();
            for (let rootFolder of rootFolders) {
                folders.push(rootFolder.name);
            }
        }
        else {
            let realPath = this.getRealPath(path);

            if (realPath != null) {
                return this.getListing(realPath);
            }
        }
        return new DirectoryListing(folders, files);
    }

    getListing(path) {
        let files = [];
        let folders = [];
        if (fs.existsSync(path)) {
            var fileListing = fs.readdirSync(path);
            for (var file of fileListing) {
                let filePath = path + "/" + file;
                if(filePath.indexOf(".DS_Store") < 0) {
                    if (fs.lstatSync(filePath).isFile()) {
                        files.push(file);
                    }
                    else {
                        folders.push(file);
                    }
                }
            }
        }

        return new DirectoryListing(folders, files);
    }

    getRealPath(internalPath) {
        if (internalPath.indexOf("/") == 0) {
            internalPath = internalPath.substring(1);
        }
        let index = internalPath.indexOf("/");
        let name = internalPath.substring(0, index);
        let subPath = internalPath.substring(index + 1);
        if (name == "") {
            name = subPath;
            subPath = "";
        }
        let folders = this.getRootFolders();
        for (let folder of folders) {
            if (folder.name == name) {
                return folder.path + "/" + subPath;
            }
        }
        return null;
    }
}

export default LocalStorage;