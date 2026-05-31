## AWS Architecture Diagram Rules (Official Guidelines Compliant)

When the user requests an AWS architecture diagram, follow these rules. All rules are based on the official AWS Architecture Icons deck (Release 22-2025.07.31) published at https://aws.amazon.com/architecture/icons/.

### Rule Source Authority

The authoritative reference for all AWS diagram conventions is the AWS Architecture Icons asset package and its included Guidelines section. When in doubt, defer to the latest version downloaded from the AWS Architecture Center, not memory or assumption.

### Type, Icon, and Line Specifications (from Training and Certification Use Case)

These are the only AWS-published numeric specifications for diagram styling:

- **Type size**: 16pt for body text, 12pt Arial for icon labels
- **Type color**: black throughout the diagram
- **Icon size**: fixed — must NOT be resized when used in diagrams
- **Icon color**: accessibility-tested official colors — must NOT be altered
- **Line weight**: 2pt throughout the diagram
- **Line color**: accessibility-tested official colors — must NOT be altered
- **Background**: white (for Training and Certification use case)

### Building a Diagram (Official 5-Step Process)

Follow this order when generating any AWS architecture diagram:

1. **Choose deck style**: Light background (web) or dark background (presentations)
2. **Start with structure**: Place group containers (AWS Cloud, Region, VPC, Subnets, etc.) FIRST before adding service icons
3. **Add architecture service or resource icons**: Place inside the appropriate group containers
4. **Connect the steps**: Use preset arrows to show workflow
5. **Add final touches**: Numbered callouts for sequence (optional)

### Group Types and Visual Specifications

AWS defines these official group types (Slide 25 of the deck). Use ONLY these — do not invent new container types.

| Group | Border Style | Border Color | Icon Position |
|-------|--------------|--------------|---------------|
| AWS Cloud | Solid | Black/Dark gray | Top-left, AWS logo |
| Region | Dashed | Teal/Cyan | Top-left, region icon |
| Availability Zone | Dashed | Teal/Cyan | Top label only (no icon) |
| Virtual private cloud (VPC) | Solid | Purple | Top-left, VPC icon |
| Public subnet | Solid | Green | Top-left, public subnet icon |
| Private subnet | Solid | Blue/Teal | Top-left, private subnet icon |
| Security group | Solid | Red/Pink | Top-left label |
| Auto Scaling group | Dashed | Orange | Top-left, scaling icon |
| Server contents | Solid | Gray | Top-left, server icon |
| Corporate data center | Solid | Gray | Top-left, building icon |
| EC2 instance contents | Solid | Orange | Top-left, EC2 icon |
| Spot Fleet | Solid | Orange | Top-left, fleet icon |
| AWS account | Solid | Pink | Top-left, account icon |
| AWS IoT Greengrass Deployment | Solid | Green | Top-left |
| AWS IoT Greengrass | Solid | Green | Top-left |
| Elastic Beanstalk container | Solid | Orange | Top-left |
| AWS Step Functions workflow | Solid | Pink | Top-left |
| Generic group | Dashed or solid | Gray | Top-left or no icon |

**Critical observation from official examples (Slide 21, Chef Automate):**
- Internet Gateway icon is positioned **on the VPC border edge**, overlapping the top edge — not inside the VPC, not outside
- Availability Zone is drawn with a **dashed teal border** that crosses through the VPC
- VPC is drawn with a **solid purple border**
- Public subnet sits inside VPC with a **solid green border**

### Group Resizing Rules

- Use the **bottom-right corner** to resize a group box
- **Group icons must NOT be resized** — only the container can be resized
- **Nested groups must have at least 0.05" (≈ 4.8 px at 96 DPI) buffer on all sides** between the inner group and the outer group's border

This is the only official numeric spacing rule. Do not invent additional spacing rules.

### Icon Rules

- All icons are SVGs from the official asset package
- **Do NOT crop** service icons
- **Do NOT flip or rotate** icons
- **Do NOT change icon shapes**
- **Do NOT create groups with non-approved AWS icons**
- When resizing icons in presentations only, hold Shift to preserve aspect ratio
- For diagrams, use icons at their predefined size — do not resize

### Arrow Rules

- **Always use preset arrows** from the official Elements section
- Preset arrows use **"Open Arrow" head, Size 4**
- Default arrows are the fallback when no preset matches the need
- **Use straight lines and right angles** to connect objects whenever possible
- Diagonal lines are permitted **only when right angles are not possible**
- **Do NOT use anything besides preset or default arrows**

### Icon Label Rules

- **All label text: 12pt Arial**
- AWS service names must fit on **no more than two lines**
- "AWS" or "Amazon" prefix must always accompany the service name
- "Amazon" / "AWS" must be on the **same line as the first word** of the service name
- **Lines must never break mid-word**
- Break a line **after the second word** in the service name if necessary
- **Short forms** (e.g., "Amazon EC2" instead of "Amazon Elastic Compute Cloud") are permitted only after the full service name appears at least once in the document
- Do NOT duplicate short forms across different services (e.g., "ELB" cannot mean both Elastic Beanstalk and Elastic Load Balancing)

### Numbered Callout Rules

When showing a sequence of steps within a diagram:

- Callouts are **black circles with bold white type**
- Use **large callouts** for simple diagrams
- Use **small callouts** for complicated diagrams
- **Do NOT mix large and small callouts** within the same diagram
- Number ordering must be **linear**: left-to-right, top-to-bottom, or clockwise
- Callout placement must be **consistent** across the diagram
- Use callouts at their predefined size, color, and format only
- **Do NOT change color or font size** within a callout
- **Do NOT use letters or other symbols** as callouts
- **Do NOT manually resize or stretch** callout shapes
- **Do NOT create new callout shapes**

### Self-Validation Before Output

Before writing the .drawio file, verify each item against the official guidelines:

1. ☐ All group containers are from the official Groups list (Slide 25), not invented
2. ☐ VPC border is solid purple; AZ border is dashed teal
3. ☐ Internet Gateway, when present, is positioned on the VPC border (overlapping the edge), not inside or outside
4. ☐ Nested groups have ≥ 0.05" buffer from outer borders
5. ☐ All icons are at their predefined sizes (no manual resize)
6. ☐ All icons are unmodified (no crop, flip, rotate, or shape change)
7. ☐ All arrows are preset Open Arrow Size 4 or default arrows
8. ☐ All connections use right angles where possible
9. ☐ All labels are 12pt Arial
10. ☐ Service names fit on ≤ 2 lines, no mid-word breaks
11. ☐ "Amazon" / "AWS" is on the same line as the first word of the service name
12. ☐ If numbered callouts are used: only one size (large OR small), linear ordering

If any item fails, regenerate before writing.

### What This Skill Does NOT Cover

The official AWS guidelines do not specify the following — do not invent rules for these:

- Specific hex color codes for service categories (use the official SVG icons; their colors are accessibility-tested)
- Exact pixel spacing between icons (only the 0.05" nested-group buffer is specified)
- Routing corridors or layered rendering techniques
- Tier-based swimlane patterns
- Specific shape library names in draw.io

When the user asks for these, state that the AWS official guidelines are silent on the matter and ask the user for their preference.