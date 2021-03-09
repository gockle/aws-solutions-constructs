/**
 *  Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */
import { Construct, SecretValue } from '@aws-cdk/core'
import { BuildSpec, PipelineProject, LinuxBuildImage } from '@aws-cdk/aws-codebuild'
import { Pipeline, Artifact } from '@aws-cdk/aws-codepipeline';
import { Repository } from '@aws-cdk/aws-codecommit';
import { CodeCommitSourceAction, CodeBuildAction, GitHubSourceAction, GitHubTrigger, S3SourceAction, S3Trigger } from '@aws-cdk/aws-codepipeline-actions';
import * as defaults from '@aws-solutions-constructs/core';


interface CodeBuildToCodePipelineProps {
    readonly buildSpecForBuild: BuildSpec
}

abstract class CodeBuildToCodePipeline extends Construct {

    public readonly codepipeline: Pipeline;
    protected readonly sourceOutputArtifact: Artifact;
    protected readonly buildOutputArtifact: Artifact;
    protected readonly codeBuildProject: PipelineProject;

    constructor(scope: Construct, id: string, props: CodeBuildToCodePipelineProps) {
        super(scope, id);
        this.codepipeline = new Pipeline(this, "CodePipeline");

        this.sourceOutputArtifact = new Artifact("SourceArtifact")
        this.buildOutputArtifact = new Artifact("BuildArtifact")

        this.codeBuildProject = new PipelineProject(this, "CodeBuildProject", {
            buildSpec: props.buildSpecForBuild,
            environment: {
                buildImage: LinuxBuildImage.STANDARD_4_0
            }
        })
    }
}

export interface GithubRepositoryProps extends CodeBuildToCodePipelineProps {
    readonly owner: string;
    readonly name: string;
    readonly secretId: string;
    readonly branchName: string;
}

export class CodeCommitToCodeBuildToCodePipeline extends CodeBuildToCodePipeline {

    /**
     * @summary Constructs a new instance of the CodeCommitToCodeBuildToCodePipeline class.
     * @param {cdk.App} scope - represents the scope for all the resources.
     * @param {string} id - this is a a scope-unique id.
     * @param {CodeCommitRepositoryProps} props - user provided props for the construct
     * @since 0.0.0
     * @access public
     */
    constructor(scope: Construct, id: string, props: CodeCommitRepositoryProps) {
        super(scope, id, props);


        let codeBuildSourceCodeAction = new CodeCommitSourceAction({
            actionName: "SourceAction",
            repository: new Repository(this, "CodeCommitRepository", {
                repositoryName: props.name
            }),
            output: this.sourceOutputArtifact,
            branch: props.branchName
        })

        const codeBuildAction = new CodeBuildAction({
            actionName: "BuildAction",
            input: this.sourceOutputArtifact,
            project: this.codeBuildProject,
            outputs: [this.buildOutputArtifact]
        })

        this.codepipeline.addStage({
            stageName: "SourceStage",
            actions: [codeBuildSourceCodeAction]
        })

        this.codepipeline.addStage({
            stageName: 'BuildStage',
            actions: [codeBuildAction]
        })
    }
}


export interface CodeCommitRepositoryProps extends CodeBuildToCodePipelineProps {
    readonly name: string,
    readonly branchName: string;
}

export class GitHubToCodeBuildToCodePipeline extends CodeBuildToCodePipeline {

    /**
     * @summary Constructs a new instance of the GitHubToCodeBuildToCodePipeline class.
     * @param {cdk.App} scope - represents the scope for all the resources.
     * @param {string} id - this is a a scope-unique id.
     * @param {GithubRepositoryProps} props - user provided props for the construct
     * @since 0.0.0
     * @access public
     */
    constructor(scope: Construct, id: string, props: GithubRepositoryProps) {
        super(scope, id, props);

        const oauth = SecretValue.secretsManager(props.secretId);
        let codeBuildSourceCodeAction = new GitHubSourceAction({
            actionName: "SourceAction",
            oauthToken: oauth,
            output: this.sourceOutputArtifact,
            owner: props.owner,
            repo: props.name,
            branch: props.branchName,
            trigger: GitHubTrigger.WEBHOOK
        })

        const codeBuildAction = new CodeBuildAction({
            actionName: "BuildAction",
            input: this.sourceOutputArtifact,
            project: this.codeBuildProject,
            outputs: [this.buildOutputArtifact]
        })

        this.codepipeline.addStage({
            stageName: "SourceStage",
            actions: [codeBuildSourceCodeAction]
        })

        this.codepipeline.addStage({
            stageName: 'BuildStage',
            actions: [codeBuildAction]
        })
    }
}

export interface S3SourceProps extends CodeBuildToCodePipelineProps {
    readonly objectKey: string;
}

export class S3ToCodeBuildToCodePipeline extends CodeBuildToCodePipeline {

    /**
     * @summary Constructs a new instance of the S3ToCodeBuildToCodePipeline class.
     * @param {cdk.App} scope - represents the scope for all the resources.
     * @param {string} id - this is a a scope-unique id.
     * @param {S3SourceProps} props - user provided props for the construct
     * @since 0.0.0
     * @access public
     */
    constructor(scope: Construct, id: string, props: S3SourceProps) {
        super(scope, id, props);

        const [sourceCodeS3Bucket] = defaults.buildS3Bucket(this, {
            bucketProps: {
                versioned: true
            }
        })

        let codeBuildSourceCodeAction = new S3SourceAction({
            actionName: "SourceAction",
            output: this.sourceOutputArtifact,
            bucket: sourceCodeS3Bucket,
            bucketKey: props.objectKey,
            trigger: S3Trigger.POLL
        })

        const codeBuildAction = new CodeBuildAction({
            actionName: "BuildAction",
            input: this.sourceOutputArtifact,
            project: this.codeBuildProject,
            outputs: [this.buildOutputArtifact]
        })

        this.codepipeline.addStage({
            stageName: "SourceStage",
            actions: [codeBuildSourceCodeAction]
        })

        this.codepipeline.addStage({
            stageName: 'BuildStage',
            actions: [codeBuildAction]
        })
    }
}