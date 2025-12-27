import { Action, ActionPanel, Icon, List, useNavigation, confirmAlert, Alert, Color } from "@raycast/api";
import { useEffect, useState } from "react";
import { getTemplates, deleteTemplate, promoteTemplate, Template } from "./utils/templates";
import SaveTemplate from "./save-template";

interface TemplatesProps {
  onSelect: (template: Template) => void;
}

export default function Templates({ onSelect }: TemplatesProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { pop } = useNavigation();

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setIsLoading(true);
    const items = await getTemplates();
    setTemplates(items);
    setIsLoading(false);
  }

  async function handleDelete(template: Template) {
    if (
      await confirmAlert({
        title: "Delete Template",
        message: template.isShared
          ? "This will delete the template from templates.json. This operation writes to your file system."
          : "Are you sure you want to delete this template?",
        primaryAction: {
          title: "Delete",
          style: Alert.ActionStyle.Destructive,
        },
      })
    ) {
      await deleteTemplate(template.id, !!template.isShared);
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
    }
  }

  async function handlePromote(template: Template) {
    if (
      await confirmAlert({
        title: "Promote to Shared",
        message:
          "This will move the template to templates.json so it can be synced via dotfiles. It may trigger a reload.",
        primaryAction: { title: "Promote", style: Alert.ActionStyle.Default },
      })
    ) {
      setIsLoading(true);
      await promoteTemplate(template);
      await loadTemplates();
    }
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search templates...">
      {templates.length === 0 ? (
        <List.EmptyView
          title="No templates yet"
          description="Save a prompt pattern as a template to see it here."
          icon={Icon.Document}
        />
      ) : (
        templates.map((template) => (
          <List.Item
            key={template.id}
            title={template.name}
            subtitle={template.variables.length > 0 ? `${template.variables.length} vars` : undefined}
            icon={template.isShared ? { source: Icon.Globe, tintColor: Color.Blue } : Icon.Document}
            accessories={[
              {
                text: template.isShared ? "Shared" : "Local",
                tooltip: template.isShared ? "Synced via templates.json" : "Local Storage",
              },
              { date: new Date(template.createdAt) },
            ]}
            actions={
              <ActionPanel>
                <Action
                  title="Use Template"
                  icon={Icon.Check}
                  onAction={() => {
                    onSelect(template);
                    pop();
                  }}
                />
                <ActionPanel.Section>
                  <Action.Push
                    title="Edit Template"
                    icon={Icon.Pencil}
                    shortcut={{ modifiers: ["cmd"], key: "e" }}
                    target={<SaveTemplate content={template.content} existingTemplate={template} />}
                    onPop={loadTemplates}
                  />
                  {!template.isShared && (
                    <Action
                      title="Promote to Shared"
                      icon={Icon.Upload}
                      shortcut={{ modifiers: ["cmd"], key: "p" }}
                      onAction={() => handlePromote(template)}
                    />
                  )}
                  <Action
                    title="Delete Template"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    onAction={() => handleDelete(template)}
                    shortcut={{ modifiers: ["cmd"], key: "backspace" }}
                  />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
