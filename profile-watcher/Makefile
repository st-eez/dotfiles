# Builds the profile-watcher binary into the aerospace stow package.
# The binary is gitignored; source of truth is profile-watcher.swift.

BIN := ../aerospace/.local/bin/profile-watcher
SRC := profile-watcher.swift

$(BIN): $(SRC)
	mkdir -p $(dir $(BIN))
	swiftc -O -o $(BIN) $(SRC)

clean:
	rm -f $(BIN)

.PHONY: clean
