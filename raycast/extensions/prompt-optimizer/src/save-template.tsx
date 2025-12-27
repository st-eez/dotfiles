import { Action, ActionPanel, Form, useNavigation, showToast, Toast } from "@raycast/api";
import { useState } from "react";
import { saveTemplate, updateTemplate, Template } from "./utils/templates";

interface SaveTemplateProps {
  content: string;
  existingTemplate?: Template;
}

export default function SaveTemplate({ content, existingTemplate }: SaveTemplateProps) {
  const [name, setName] = useState(existingTemplate?.name ?? "");
  const [templateContent, setTemplateContent] = useState(existingTemplate?.content ?? content);
  const { pop } = useNavigation();

  const isEditing = !!existingTemplate;

  async function handleSubmit() {
    if (!name.trim()) {
      showToast({ style: Toast.Style.Failure, title: "Name is required" });
      return;
    }

    try {
      if (isEditing && existingTemplate) {
        await updateTemplate(existingTemplate.id, name, templateContent, !!existingTemplate.isShared);
        showToast({ style: Toast.Style.Success, title: "Template updated" });
      } else {
        await saveTemplate(name, templateContent);
        showToast({ style: Toast.Style.Success, title: "Template saved" });
      }
      pop();
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: isEditing ? "Failed to update template" : "Failed to save template",
        message: String(error),
      });
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title={isEditing ? "Update Template" : "Save Template"} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Template Name"
        placeholder="e.g. Unit Test Generator"
        value={name}
        onChange={setName}
        autoFocus
      />
      <Form.TextArea
        id="content"
        title="Template Pattern"
        placeholder="Enter your prompt pattern here..."
        value={templateContent}
        onChange={setTemplateContent}
        info="Use {{variableName}} to define dynamic variables."
      />
      <Form.Description text={isEditing ? "Modify name and content." : "The current prompt pattern will be saved."} />
    </Form>
  );
}
